# Deploying JobPing to Oracle Cloud (free, forever)

This is Step 9 of `CLAUDE.md`'s build order. Target: Oracle Cloud's
**Always Free** tier — a real VM, free indefinitely (not a 12-month
trial), with enough compute to run the existing `docker-compose.yml`
stack (api, worker, db, redis, rabbitmq, nginx) basically as-is.

Read this top to bottom once before starting — the TLS certificate step
in particular has to happen in a specific order (site live on HTTP first,
_then_ get the cert, _then_ switch to HTTPS) or it won't work.

---

## 0. What you need before starting

- An Oracle Cloud account (oracle.com/cloud/free — requires a card for
  identity verification, you will not be charged for Always Free
  resources).
- A domain name pointed at Oracle, or a free subdomain via
  [duckdns.org](https://www.duckdns.org) if you don't want to buy one yet.
- An SSH key pair on your own machine (`ssh-keygen` if you don't have one).
- A SendGrid account + API key, if you want real emails sent (optional —
  the app runs fine without one, emails just fail and land in
  `mail_queue.status = Failed` via the retry ladder, which is a legitimate
  way to see the pipeline work without paying for email).

---

## 1. Create the VM

1. Oracle Cloud Console → **Compute → Instances → Create Instance**.
2. **Image**: Canonical Ubuntu 22.04 (or newer LTS).
3. **Shape**: click "Change shape" → **Ampere (ARM)** → `VM.Standard.A1.Flex`.
   Set 2 OCPU / 12 GB RAM (well inside the Always Free allowance of up to
   4 OCPU / 24 GB total — you can split this across more than one VM
   later, but one VM is simplest for this stack).
4. **Networking**: let it create a new VCN if you don't have one. Make
   sure "Assign a public IPv4 address" is checked.
5. **SSH keys**: paste your public key (`~/.ssh/id_ed25519.pub` or
   similar).
6. Create. Note the **public IP** once it's running.

> If you get "Out of capacity for shape VM.Standard.A1.Flex" — this is a
> known Oracle Always Free thing, capacity is genuinely limited per
> region. Retry in a few hours, try a different Availability Domain in
> the same region, or as a last resort pick a different region when
> creating the VM.

---

## 2. Open the firewall — cloud side AND OS side

Both layers default to blocking everything except SSH. Both need explicit
rules, or the site won't be reachable even once everything is running.

**Cloud side (Oracle Security List):**
Networking → Virtual Cloud Networks → your VCN → Security Lists → default
security list → Add Ingress Rules:

| Source CIDR | Protocol | Port |
|---|---|---|
| 0.0.0.0/0 | TCP | 22 (should already exist) |
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

**Do not** add rules for 5432, 6379, 5672, or 15672 — those are the
database/Redis/RabbitMQ ports and must stay unreachable from the public
internet (see the comments in `docker-compose.yml`).

**OS side (Ubuntu's own iptables, pre-configured by Oracle's image):**
```bash
ssh ubuntu@<your-vm-ip>
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save   # persists across reboots
```

---

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker          # picks up the group without a full re-login
sudo systemctl enable docker   # start on boot
docker compose version         # sanity check — should print v2.x
```

---

## 4. Get the code onto the server and configure it

```bash
git clone https://github.com/<your-username>/JobPing.git
cd JobPing
cp .env.example .env
nano .env
```

Fill in real values for every `change_me` — a strong random string for
each of `DB_PASSWORD`, `JWT_SECRET` (32+ characters), `REDIS_PASSWORD`,
`RABBITMQ_PASSWORD`. Set `DOMAIN=` to your real domain or DuckDNS
subdomain. Leave `SENDGRID_API_KEY` blank if you don't have one yet.
Also carry over your real `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and
`JSEARCH_API_KEY` from your local `.env` — these are the same values,
not server-specific ones.

```bash
openssl rand -base64 32   # handy for generating each of those
```

---

## 5. Point your domain at the server

At your DNS provider (or DuckDNS's own page if using that), create an
**A record** for your domain/subdomain pointing at the VM's public IP.
DNS can take a few minutes to a few hours to propagate — confirm with
`dig yourdomain.com` or `nslookup yourdomain.com` before moving on to the
certificate step, since Let's Encrypt needs it to already resolve.

---

## 6. First boot — HTTP only

The checked-in nginx config (`nginx/templates/app.conf.template`) is
deliberately HTTP-only to start — there's no certificate yet, so an
HTTPS server block would just fail to start nginx entirely.

```bash
docker compose up -d --build
docker compose ps          # everything should show "healthy" or "running"
curl http://localhost/health
```

From your own machine: `http://yourdomain.com` should now load the app
(with a "not secure" warning, expected at this stage).

---

## 7. Run the database migration

Production never auto-migrates (see `Program.cs` / `CLAUDE.md` coding
rule 14), so this is a one-time manual step — and every time you add a
new migration afterward.

Run it from your **own machine** through an SSH tunnel, so Postgres is
never exposed to the public internet even temporarily:

```bash
# On your own machine, in a separate terminal (keep this running):
ssh -L 5433:localhost:5433 ubuntu@<your-vm-ip>

# In another terminal, from the repo root on your own machine:
dotnet ef database update \
  --project src/JobPing.Infrastructure \
  --startup-project src/JobPing.API \
  --connection "Host=localhost;Port=5433;Database=jobping;Username=postgres;Password=<the DB_PASSWORD you put in .env>"
```

Close the SSH tunnel when done.

---

## 8. Get a TLS certificate

Certbot proves you control the domain by writing a file nginx serves at
`/.well-known/acme-challenge/` — already wired up in the bootstrap
config from step 6, which is why HTTP had to be working first.

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d yourdomain.com \
  --email you@example.com --agree-tos --no-eff-email
```

If that succeeds, certs now exist in the `certbot_conf` volume at
`/etc/letsencrypt/live/yourdomain.com/`.

---

## 9. Switch nginx to HTTPS

Replace the contents of `nginx/templates/app.conf.template` on the server
with the block below (same `${DOMAIN}` templating, now with a 443 server
block and an HTTP→HTTPS redirect):

```nginx
upstream api {
  server api:80;
}

server {
  listen 80;
  server_name ${DOMAIN};

  # Keep this reachable over plain HTTP — certbot renewal needs it.
  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen 443 ssl;
  server_name ${DOMAIN};

  ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  ssl_protocols       TLSv1.2 TLSv1.3;

  location /api/ {
    proxy_pass http://api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /health {
    proxy_pass http://api;
  }

  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }
}
```

```bash
nano nginx/templates/app.conf.template   # paste the block above in
docker compose up -d --build nginx
curl -I https://yourdomain.com
```

`https://yourdomain.com` should now load with a valid padlock, and
`http://yourdomain.com` should redirect to it.

> Commit this change back to the repo too, so a fresh clone deploys with
> HTTPS already configured next time.

---

## 10. Certificate auto-renewal

Let's Encrypt certs expire every 90 days. Set up a cron job on the VM:

```bash
crontab -e
```

Add:
```
0 3 * * 1 cd /home/ubuntu/JobPing && docker compose run --rm certbot renew --webroot -w /var/www/certbot -q && docker compose exec nginx nginx -s reload
```

(Runs weekly; certbot itself no-ops unless the cert is actually within 30
days of expiring.)

---

## 11. Verify everything end to end

```bash
docker compose ps
docker compose logs -f api worker    # ctrl-C to stop tailing
curl https://yourdomain.com/health
```

Register a real account through the live site, confirm the dashboard
loads, and trigger a manual fetch via the command palette (⌘K → "Run job
fetch now", if you're logged in as an Admin-role user) to confirm the
whole pipeline works against the real deployed database.

---

## Day-2 operations

**Redeploying after a code change:**
```bash
git pull
docker compose up -d --build api worker nginx
```

**Viewing logs:** `docker compose logs -f <service>`

**Backing up Postgres:**
```bash
docker compose exec db pg_dump -U postgres jobping > backup-$(date +%F).sql
```

**Restarting everything:** `docker compose restart` (containers already
have `restart: unless-stopped`, so a VM reboot brings everything back up
on its own as long as Docker itself is enabled at boot — step 3 already
did that).

---

## What this doc deliberately does NOT cover yet

- **Step 10 (CI/CD)** — none of the above is automated via GitHub Actions
  yet. Redeploys above are manual (`git pull` + `docker compose up -d
  --build` on the server). That's the natural next step once this manual
  deploy is confirmed working.
- **Automated tests in the deploy pipeline** — there are no automated
  tests in this project yet (backend or frontend), so there's nothing for
  a CI pipeline to run before deploying. Worth deciding whether to add
  tests before or alongside Step 10.
- **Monitoring/alerting** — nothing watches the server for you. `docker
  compose ps` and the worker terminal widget on the dashboard are the
  only current visibility into whether the fetch/match/mail pipeline is
  actually running on schedule.

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { IconComponent, IconName } from '../../components/icon/icon.component';

interface Step {
  icon: IconName;
  title: string;
  desc: string;
}

interface Source {
  icon: IconName;
  name: string;
}

const STEPS: Step[] = [
  { icon: 'sliders-horizontal', title: 'Set your skills', desc: 'Tell us what you work with and where you\'ll take a job — remote, on-site, or both.' },
  { icon: 'refresh-cw', title: 'We scan every 2 hours', desc: 'Fresh roles are pulled in from multiple job boards and scored against your exact profile.' },
  { icon: 'bell', title: 'Get pinged on real matches', desc: 'Only jobs above your match threshold land in your inbox — no noise, no scrolling.' },
];

const SOURCES: Source[] = [
  { icon: 'globe', name: 'Remotive' },
  { icon: 'globe', name: 'Arbeitnow' },
  { icon: 'rss', name: 'We Work Remotely' },
];

@Component({
  selector: 'app-landing',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="landing">
      <header class="landing-nav">
        <div class="landing-shell landing-nav-inner">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="topnav-logo-mark">
              <span style="color: white; font-family: var(--font-mono); font-size: 11px; font-weight: 700;">JP</span>
            </span>
            <span style="font-weight: 600; font-size: 15px; color: var(--text-primary);">JobPing</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="icon-btn" (click)="theme.toggle()" [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
              <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="16" />
            </button>
            <a routerLink="/auth/login" class="btn btn-ghost">Sign in</a>
            <a routerLink="/auth/register" class="btn btn-primary">Get started</a>
          </div>
        </div>
      </header>

      <main>
        <!-- ================= HERO ================= -->
        <section class="hero">
          <div class="hero-glow hero-glow-a"></div>
          <div class="hero-glow hero-glow-b"></div>

          <div class="landing-shell hero-grid">
            <div class="hero-copy">
              <p class="hero-kicker">// developer job alerts, automated</p>
              <h1 class="hero-title">
                Get pinged for jobs that
                <span class="hero-accent">actually match</span>
                your skills.
              </h1>
              <p class="hero-sub">
                JobPing scans fresh remote roles every 2 hours, scores them against your skill profile,
                and emails you only the strong matches.
              </p>
              <div class="hero-actions">
                <a routerLink="/auth/register" class="btn btn-primary btn-lg">
                  Create your profile
                  <app-icon name="arrow-right" [size]="15" />
                </a>
                <a routerLink="/auth/login" class="btn btn-secondary btn-lg">I already have an account</a>
              </div>

              <div class="hero-sources">
                <span class="hero-sources-label">Pulling live roles from</span>
                <div class="hero-sources-list">
                  @for (s of sources; track s.name) {
                    <span class="hero-source-chip">
                      <app-icon [name]="s.icon" [size]="12" />
                      {{ s.name }}
                    </span>
                  }
                </div>
              </div>
            </div>

            <div class="hero-preview">
              <div class="card hero-float-card hero-float-a">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">Senior .NET Developer</span>
                  <span class="match-badge high">92%</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Techwave · Remote</p>
                <div class="match-bar"><div class="match-bar-fill" style="width: 92%"></div></div>
                <div class="hero-card-tags">
                  <span class="tag">.NET Core</span>
                  <span class="tag">PostgreSQL</span>
                  <span class="tag">Docker</span>
                </div>
              </div>
              <div class="card hero-float-card hero-float-b">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">Angular Engineer</span>
                  <span class="match-badge mid">78%</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Nimbus · Remote</p>
                <div class="match-bar"><div class="match-bar-fill" style="width: 78%"></div></div>
                <div class="hero-card-tags">
                  <span class="tag">Angular</span>
                  <span class="tag">TypeScript</span>
                </div>
              </div>
              <div class="card hero-float-card hero-float-c">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">Platform Engineer</span>
                  <span class="match-badge high">88%</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Arclight · Remote</p>
                <div class="match-bar"><div class="match-bar-fill" style="width: 88%"></div></div>
                <div class="hero-card-tags">
                  <span class="tag">Kubernetes</span>
                  <span class="tag">AWS</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ================= HOW IT WORKS ================= -->
        <section class="landing-shell how-section">
          <p class="section-kicker">How it works</p>
          <h2 class="section-heading">From profile to inbox, on autopilot.</h2>

          <div class="how-grid">
            @for (s of steps; track s.title; let i = $index) {
              <div class="how-card" [style.animationDelay.ms]="i * 90">
                <div class="how-num">{{ i + 1 }}</div>
                <div class="how-icon">
                  <app-icon [name]="s.icon" [size]="18" />
                </div>
                <h3 class="how-title">{{ s.title }}</h3>
                <p class="how-desc">{{ s.desc }}</p>
              </div>
            }
          </div>
        </section>

        <!-- ================= CTA BAND ================= -->
        <section class="landing-shell">
          <div class="cta-band">
            <div class="cta-glow"></div>
            <div class="cta-content">
              <h2 class="cta-heading">Stop refreshing job boards.</h2>
              <p class="cta-sub">Set your skills once — JobPing does the scanning, scoring, and emailing.</p>
              <a routerLink="/auth/register" class="btn btn-primary btn-lg">
                Create your profile
                <app-icon name="arrow-right" [size]="15" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer class="landing-footer">
        <div class="landing-shell landing-footer-inner">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="topnav-logo-mark" style="width: 22px; height: 22px;">
              <span style="color: white; font-family: var(--font-mono); font-size: 9px; font-weight: 700;">JP</span>
            </span>
            <span style="font-size: 13px; color: var(--text-muted);">JobPing — built for developers, not job-board scrolling.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <a routerLink="/auth/login" class="view-all">Sign in</a>
            <a routerLink="/auth/register" class="view-all">Get started</a>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .landing { min-height: 100vh; background: var(--bg-page); overflow-x: hidden; }
    .landing-shell { max-width: 1100px; margin: 0 auto; padding: 0 24px; }

    .landing-nav {
      position: sticky;
      top: 0;
      z-index: 50;
      height: var(--nav-h);
      background: var(--bg-surface);
      background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-default);
    }
    .landing-nav-inner { height: 100%; display: flex; align-items: center; justify-content: space-between; }

    /* ── Hero ─────────────────────── */
    .hero { position: relative; padding: 64px 0 96px; overflow: hidden; }
    .hero-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(70px);
      pointer-events: none;
      opacity: 0.5;
      z-index: 0;
    }
    .hero-glow-a {
      width: 480px; height: 480px;
      top: -180px; left: -120px;
      background: radial-gradient(circle, var(--accent-light) 0%, transparent 70%);
    }
    .hero-glow-b {
      width: 420px; height: 420px;
      top: 40px; right: -140px;
      background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
      opacity: 0.35;
    }
    [data-theme="dark"] .hero-glow { opacity: 0.25; }

    .hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; gap: 48px; align-items: center; }
    @media (min-width: 1024px) { .hero-grid { grid-template-columns: 1.1fr 1fr; gap: 40px; } }

    .hero-kicker {
      font-family: var(--font-mono); font-size: 12px; color: var(--accent);
      margin-bottom: 14px; opacity: 0; animation: heroUp 0.5s var(--ease-out) 0.05s both;
    }
    .hero-title {
      font-size: 40px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary);
      opacity: 0; animation: heroUp 0.55s var(--ease-out) 0.12s both;
    }
    @media (min-width: 640px) { .hero-title { font-size: 48px; } }
    .hero-accent { color: var(--accent); }
    .hero-sub {
      margin-top: 18px; font-size: 16px; color: var(--text-secondary); max-width: 460px; line-height: 1.65;
      opacity: 0; animation: heroUp 0.55s var(--ease-out) 0.2s both;
    }
    .hero-actions {
      margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px;
      opacity: 0; animation: heroUp 0.55s var(--ease-out) 0.28s both;
    }
    .hero-sources {
      margin-top: 40px; opacity: 0; animation: heroUp 0.55s var(--ease-out) 0.36s both;
    }
    .hero-sources-label {
      font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted);
    }
    .hero-sources-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .hero-source-chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 500; color: var(--text-secondary);
      background: var(--bg-surface); border: 1px solid var(--border-default);
      padding: 5px 10px; border-radius: 99px; box-shadow: var(--shadow-xs);
    }

    @keyframes heroUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .hero-preview { display: none; position: relative; z-index: 1; min-height: 340px; }
    @media (min-width: 1024px) { .hero-preview { display: block; } }
    .hero-float-card {
      position: absolute;
      width: 280px;
      opacity: 0;
      animation: cardIn 0.6s var(--ease-spring) both, cardFloat 6s ease-in-out infinite;
    }
    .hero-float-a { top: 0; left: 10px; animation-delay: 0.3s, 0.9s; }
    .hero-float-b { top: 150px; left: 90px; animation-delay: 0.45s, 1.1s; }
    .hero-float-c { top: 300px; left: 20px; animation-delay: 0.6s, 1.3s; }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes cardFloat {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-8px); }
    }
    .hero-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }

    /* ── How it works ─────────────── */
    .how-section { padding: 20px 24px 88px; }
    .section-kicker {
      font-family: var(--font-mono); font-size: 12px; color: var(--accent); font-weight: 600;
    }
    .section-heading {
      font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary);
      margin-top: 6px; margin-bottom: 32px; max-width: 480px;
    }
    .how-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    @media (min-width: 768px) { .how-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; } }
    .how-card {
      background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg);
      padding: 22px 20px; box-shadow: var(--shadow-xs); position: relative;
      opacity: 0; animation: heroUp 0.5s var(--ease-out) both;
      transition: border-color var(--dur-fast), box-shadow var(--dur-fast), transform var(--dur-fast);
    }
    .how-card:hover { border-color: var(--border-accent); box-shadow: var(--shadow-md); transform: translateY(-3px); }
    .how-num {
      position: absolute; top: 16px; right: 18px;
      font-family: var(--font-mono); font-size: 12px; color: var(--text-disabled); font-weight: 600;
    }
    .how-icon {
      width: 36px; height: 36px; border-radius: var(--radius-md);
      background: var(--accent-soft); color: var(--accent);
      display: flex; align-items: center; justify-content: center; margin-bottom: 14px;
    }
    .how-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .how-desc { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

    /* ── CTA band ─────────────────── */
    .cta-band {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius-xl);
      background: linear-gradient(135deg, var(--accent), var(--accent-hover));
      padding: 48px 32px;
      margin-bottom: 88px;
      text-align: center;
      box-shadow: var(--shadow-lg);
    }
    .cta-glow {
      position: absolute; inset: 0;
      background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%);
      pointer-events: none;
    }
    .cta-content { position: relative; z-index: 1; }
    .cta-heading { font-size: 26px; font-weight: 700; color: white; letter-spacing: -0.02em; }
    .cta-sub { font-size: 14px; color: rgba(255,255,255,0.85); margin: 10px 0 24px; }
    .cta-band .btn-primary { background: white; color: var(--accent-hover); box-shadow: none; }
    .cta-band .btn-primary:hover { background: rgba(255,255,255,0.9); }

    /* ── Footer ───────────────────── */
    .landing-footer { border-top: 1px solid var(--border-default); padding: 24px 0; }
    .landing-footer-inner {
      display: flex; flex-direction: column; gap: 14px; align-items: flex-start; justify-content: space-between;
    }
    @media (min-width: 640px) { .landing-footer-inner { flex-direction: row; align-items: center; } }

    @media (prefers-reduced-motion: reduce) {
      .hero-kicker, .hero-title, .hero-sub, .hero-actions, .hero-sources, .hero-float-card, .how-card {
        opacity: 1; animation: none;
      }
    }
  `],
})
export class LandingComponent {
  readonly theme = inject(ThemeService);
  readonly steps = STEPS;
  readonly sources = SOURCES;
}

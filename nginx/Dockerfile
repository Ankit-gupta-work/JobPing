# Stage 1: Build the Angular app.
# CLAUDE.md's original spec used a plain `image: nginx:alpine` and expected the Angular
# build to already exist at /usr/share/nginx/html — but nothing in the spec ever builds
# it. Doing the build here instead, so `docker compose up` actually serves the real app
# rather than nginx's default landing page.
FROM node:20-alpine AS build
WORKDIR /app

COPY jobping-ui/package.json jobping-ui/package-lock.json ./
RUN npm ci

COPY jobping-ui/ ./
RUN npm run build

# Stage 2: Serve with nginx.
FROM nginx:alpine
# Angular 21's application builder outputs to dist/<project>/browser, not dist/<project>.
COPY --from=build /app/dist/jobping-ui/browser /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

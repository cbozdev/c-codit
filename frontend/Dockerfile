# syntax=docker/dockerfile:1.6
#
# Frontend build: Vite production build, served by nginx, port-aware for Render.
#

############################
# Stage 1: build
############################
FROM node:20-alpine AS build

WORKDIR /app

ENV CI=true \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package*.json ./

RUN npm ci --no-audit --no-fund

COPY . .

# VITE_API_URL is baked into the bundle; it must be set at build time.
ARG VITE_API_URL=https://api.c-codit.com/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

############################
# Stage 2: runtime
############################
FROM nginx:1.27-alpine AS runtime

ENV PORT=8080

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY entrypoint.sh /docker-entrypoint.d/40-render-port.sh
RUN chmod +x /docker-entrypoint.d/40-render-port.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

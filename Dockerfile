# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Where to download npm packages from. Point it at a mirror if registry.npmjs.org is slow or blocked.
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry="$NPM_REGISTRY" --replace-registry-host=always

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data
RUN groupadd --system --gid 1001 dock \
 && useradd --system --uid 1001 --gid dock --home /app dock \
 && mkdir -p /data \
 && chown dock:dock /data
COPY --from=build --chown=dock:dock /app/public ./public
COPY --from=build --chown=dock:dock /app/.next/standalone ./
COPY --from=build --chown=dock:dock /app/.next/static ./.next/static
USER dock
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

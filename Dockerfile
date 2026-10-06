# ARCHERITAGE Docs — optional Render image with Office and video conversion.
# The existing Native Node service does not use this file until its runtime changes.
#
# Build:  docker build -t archeritage-docs .
# Run:    docker run --env-file .env -p 3000:3000 archeritage-docs

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SOFFICE_PATH=/usr/bin/soffice
# System ffmpeg used when FFMPEG_PATH is unset (also detected via PATH).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ffmpeg libreoffice-writer libreoffice-impress libreoffice-calc \
     fonts-dejavu-core fonts-liberation \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/.cache \
  && chown nextjs:nodejs /app/.cache

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/scripts/check-office-runtime.mjs ./scripts/check-office-runtime.mjs

USER nextjs
# Validate the dependency and scratch space with the same user as production.
RUN node scripts/check-office-runtime.mjs
EXPOSE 3000
CMD ["node", "server.js"]

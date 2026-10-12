FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig fonts-noto-cjk fonts-dejavu-core curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN mkdir -p /app/cache/github && chown -R node:node /app/cache
ENV NODE_ENV=production PORT=2323 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node apps/web/.next/standalone ./
COPY --chown=node:node apps/web/public ./apps/web/public
COPY --chown=node:node apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 2323
CMD ["node", "apps/web/server.js"]

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
ENV NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN BETTER_AUTH_SECRET=build-only-placeholder-with-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ARG APP_VERSION=dev
ARG VCS_REF=unknown
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
LABEL org.opencontainers.image.title="Keeply" \
      org.opencontainers.image.description="Self-hosted, local-first personal belongings archive" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$VCS_REF
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
RUN node -e "import('pg')"
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

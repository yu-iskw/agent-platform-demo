# Build from repository root
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/mcp-auth/package.json packages/mcp-auth/
COPY packages/agent-client/package.json packages/agent-client/
COPY packages/a2a-server/package.json packages/a2a-server/
COPY packages/remote-agent/package.json packages/remote-agent/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @agent-platform/remote-agent...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/mcp-auth/node_modules ./packages/mcp-auth/node_modules
COPY --from=deps /app/packages/agent-client/node_modules ./packages/agent-client/node_modules
COPY --from=deps /app/packages/a2a-server/node_modules ./packages/a2a-server/node_modules
COPY --from=deps /app/packages/remote-agent/node_modules ./packages/remote-agent/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/mcp-auth packages/mcp-auth
COPY packages/agent-client packages/agent-client
COPY packages/a2a-server packages/a2a-server
COPY packages/remote-agent packages/remote-agent
RUN pnpm --filter @agent-platform/mcp-auth build \
  && pnpm --filter @agent-platform/agent-client build \
  && pnpm --filter @agent-platform/a2a-server build \
  && pnpm --filter @agent-platform/remote-agent build
RUN pnpm deploy --filter @agent-platform/remote-agent --prod --legacy /prod

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8081
COPY --from=build /prod .
RUN chown -R node:node /app
USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "dist/index.js"]

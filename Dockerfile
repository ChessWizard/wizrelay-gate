# syntax=docker/dockerfile:1

# =============================================================================
# wizrelay-gate — a multi-user panel. See docs/en/17-docker.md.
# =============================================================================

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# The migration runner, with a dependency tree of its own.
#
# The traced standalone output carries what the app imports, and the app never imports the
# Prisma CLI — so copying the CLI alone left it looking for `effect` and failing on first
# boot. It gets its own small tree here instead of dragging the whole build's node_modules
# into the image.
FROM node:22-alpine AS prismacli
WORKDIR /cli
COPY package.json ./
RUN PRISMA_VERSION="$(node -p "(require('./package.json').devDependencies||{}).prisma || (require('./package.json').dependencies||{}).prisma")" \
 && rm -f package.json \
 && npm init -y > /dev/null \
 && npm install --no-audit --no-fund --omit=dev "prisma@${PRISMA_VERSION}"

FROM node:22-alpine AS runtime

# git and openssh-client read the hub; python3 hosts the wizrelay CLI; openssl is
# Prisma's; su-exec drops privileges after the entrypoint has fixed the volume.
RUN apk add --no-cache libc6-compat git openssh-client python3 openssl tini su-exec

# The panel's own database, inside the image, so `docker run` is the whole installation.
# Set DATABASE_URL and it is never started; build with EMBEDDED_POSTGRES=false to leave
# it out of the image entirely.
ARG EMBEDDED_POSTGRES="true"
RUN if [ "$EMBEDDED_POSTGRES" = "true" ]; then \
      apk add --no-cache postgresql postgresql-client; \
    fi

# The CLI the deterministic gates run. Pin to a tag once the plugin has one, or pass an
# empty value to leave it out: --build-arg WIZRELAY_SPEC=""
ARG WIZRELAY_SPEC="git+https://github.com/ChessWizard/wizrelay@main"
RUN if [ -n "$WIZRELAY_SPEC" ]; then \
      apk add --no-cache py3-pip && \
      python3 -m venv /opt/wizrelay && \
      /opt/wizrelay/bin/pip install --no-cache-dir "$WIZRELAY_SPEC" && \
      ln -s /opt/wizrelay/bin/wizrelay /usr/local/bin/wizrelay; \
    fi

# Claude Code, for the conversational gates. Off by default: it is large and it needs
# authentication, which belongs in a mount rather than an image.
ARG INSTALL_CLAUDE_CODE="false"
RUN if [ "$INSTALL_CLAUDE_CODE" = "true" ]; then \
      npm install -g @anthropic-ai/claude-code && npm cache clean --force; \
    fi

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0 \
    WIZRELAY_GATE_HOME=/data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Standalone output does not carry `public`; the agent that machines download lives
# there, so the panel and its agents can never be different versions of each other.
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prismacli /cli/node_modules /opt/prisma/node_modules
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Hub clones, gate logs, uploads, and the built-in database when there is one.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3100/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

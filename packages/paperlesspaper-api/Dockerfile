# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=24.11.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production" \
    PUPPETEER_SKIP_DOWNLOAD="true"


# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install node modules
COPY package.json ./
ARG NPM_TOKEN=""
ARG NPMRC_BASE64=""
RUN if [ -n "$NPMRC_BASE64" ]; then printf "%s" "$NPMRC_BASE64" | base64 -d > "$HOME/.npmrc"; \
    elif [ -n "$NPM_TOKEN" ]; then printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" > "$HOME/.npmrc"; fi && \
    npm install --omit=dev && \
    rm -f "$HOME/.npmrc"

# Copy application code
COPY . .


# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build --chown=node:node /app /app
# The shared API library writes its Auth0 token caches relative to /app.
RUN chown node:node /app

# RUN  apt-get -y update && apt-get install -y ffmpeg

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health', { signal: AbortSignal.timeout(8000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
USER node
CMD [ "npm", "run", "start" ]

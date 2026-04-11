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
    apt-get install --no-install-recommends -y chromium chromium-sandbox && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app /app

# RUN  apt-get -y update && apt-get install -y ffmpeg

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
ENV CHROME_BIN="/usr/bin/chromium"
CMD [ "npm", "run", "start" ]

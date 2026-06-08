# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.11.0
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app

FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential ca-certificates git node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY package.json yarn.lock ./
COPY packages/helpers/package.json packages/helpers/package.json
COPY packages/paperlesspaper-web/package.json packages/paperlesspaper-web/.npmrc.docker packages/paperlesspaper-web/

ARG AZURE_ARTIFACTS_NPM_TOKEN=""
RUN corepack enable && \
    if [ -z "$AZURE_ARTIFACTS_NPM_TOKEN" ]; then echo "AZURE_ARTIFACTS_NPM_TOKEN build arg is required" >&2; exit 1; fi && \
    AZURE_ARTIFACTS_NPM_PASSWORD_B64="$(printf "%s" "$AZURE_ARTIFACTS_NPM_TOKEN" | base64 | tr -d '\n')" && \
    sed "s#__AZURE_ARTIFACTS_NPM_PASSWORD_B64__#$AZURE_ARTIFACTS_NPM_PASSWORD_B64#g" packages/paperlesspaper-web/.npmrc.docker > .npmrc && \
    yarn install --frozen-lockfile --non-interactive && \
    rm -f .npmrc

COPY packages/helpers packages/helpers
COPY packages/paperlesspaper-web packages/paperlesspaper-web

ARG REACT_APP_AUTH0_AUDIENCE=""
ARG REACT_APP_AUTH0_CLIENT_ID=""
ARG REACT_APP_AUTH0_DOMAIN=""
ARG REACT_APP_AUTH_REDIRECT_URL=""
ARG REACT_APP_CHATWOOT=""
ARG REACT_APP_GOOGLE_CLIENT_ID=""
ARG REACT_APP_GOOGLE_MAPS_API_KEY=""
ARG REACT_APP_IDENTIFIER=""
ARG REACT_APP_IDENTIFIER_IOS=""
ARG REACT_APP_SERVER_BASE_URL=""
ARG REACT_APP_SERVER_WEBSITE_URL=""
ARG REACT_APP_TRANSLATION_SECRET=""
ARG REACT_APP_WEB_BACKEND_URL=""

ENV REACT_APP_AUTH0_AUDIENCE=$REACT_APP_AUTH0_AUDIENCE \
    REACT_APP_AUTH0_CLIENT_ID=$REACT_APP_AUTH0_CLIENT_ID \
    REACT_APP_AUTH0_DOMAIN=$REACT_APP_AUTH0_DOMAIN \
    REACT_APP_AUTH_REDIRECT_URL=$REACT_APP_AUTH_REDIRECT_URL \
    REACT_APP_CHATWOOT=$REACT_APP_CHATWOOT \
    REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID \
    REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY \
    REACT_APP_IDENTIFIER=$REACT_APP_IDENTIFIER \
    REACT_APP_IDENTIFIER_IOS=$REACT_APP_IDENTIFIER_IOS \
    REACT_APP_SERVER_BASE_URL=$REACT_APP_SERVER_BASE_URL \
    REACT_APP_SERVER_WEBSITE_URL=$REACT_APP_SERVER_WEBSITE_URL \
    REACT_APP_TRANSLATION_SECRET=$REACT_APP_TRANSLATION_SECRET \
    REACT_APP_WEB_BACKEND_URL=$REACT_APP_WEB_BACKEND_URL

RUN yarn --cwd packages/helpers build
RUN yarn --cwd packages/paperlesspaper-web build:production

FROM base AS runtime

ENV NODE_ENV=production

COPY --from=build /app/packages/paperlesspaper-web/dist ./dist
COPY --from=build /app/packages/paperlesspaper-web/server.mjs ./server.mjs
COPY --from=build /app/packages/paperlesspaper-web/package.json ./package.json

EXPOSE 3000

CMD ["node", "server.mjs"]

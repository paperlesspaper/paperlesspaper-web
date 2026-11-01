FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node packages/slideshow-monitor/src ./src
RUN mkdir /data && chown node:node /data
USER node
ENV STATE_FILE=/data/slideshows.json
HEALTHCHECK --interval=60s --start-period=300s --timeout=5s --retries=3 CMD node -e 'const s=JSON.parse(require("fs").readFileSync(process.env.STATE_FILE));process.exit(Date.now()-Date.parse(s.lastCompletedAt)<Math.max(360,Number(process.env.SCAN_TIMEOUT_SECONDS||300)+Number(process.env.CHECK_INTERVAL_SECONDS||120)*2)*1000?0:1)'
CMD ["node", "src/index.mjs", "service"]

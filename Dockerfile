# Base image ships Chromium/Firefox/WebKit plus every OS-level dependency Playwright needs —
# the tag's version MUST match the @playwright/test version pinned in package.json exactly,
# or the browser binaries and the npm package can drift out of sync and audits fail to launch.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3005

CMD ["node", "dashboard/server.js"]

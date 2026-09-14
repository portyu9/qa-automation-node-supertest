FROM node:24.21.0-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553

USER root
RUN npm install --global --ignore-scripts npm@11.19.1 --no-audit --no-fund \
    && test "$(npm --version)" = "11.19.1" \
    && npm cache clean --force

WORKDIR /usr/src/app
RUN chown node:node /usr/src/app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY --chown=node:node . .

USER node

CMD ["npm", "test"]

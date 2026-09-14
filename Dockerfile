FROM node:24.21.0-trixie-slim@sha256:db3ae80f5d8df06e04dabdf7b44cbf008d32de168205fa0294444aabbc08c590

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

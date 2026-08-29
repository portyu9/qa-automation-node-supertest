FROM node:26-alpine

WORKDIR /usr/src/app
RUN chown node:node /usr/src/app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY --chown=node:node . .

USER node

CMD ["npm", "test"]

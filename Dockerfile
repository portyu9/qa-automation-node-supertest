FROM node:24.21.0-trixie-slim@sha256:db3ae80f5d8df06e04dabdf7b44cbf008d32de168205fa0294444aabbc08c590

ARG GZIP_VERSION=1.13-1+deb13u1
ARG PCRE2_VERSION=10.46-1~deb13u2
ARG SQLITE3_VERSION=3.46.1-7+deb13u2
ARG PERL_BASE_VERSION=5.40.1-6+deb13u1

USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      "gzip=${GZIP_VERSION}" \
      "libpcre2-8-0=${PCRE2_VERSION}" \
      "libsqlite3-0=${SQLITE3_VERSION}" \
      "perl-base=${PERL_BASE_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' gzip)" = "${GZIP_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' libpcre2-8-0)" = "${PCRE2_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' libsqlite3-0)" = "${SQLITE3_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' perl-base)" = "${PERL_BASE_VERSION}"; \
    rm -rf /var/lib/apt/lists/*
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

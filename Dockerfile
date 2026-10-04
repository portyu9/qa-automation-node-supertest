FROM node:24.21.0-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe

ARG GZIP_VERSION=1.13-1+deb13u1
ARG PCRE2_VERSION=10.46-1~deb13u3
ARG SQLITE3_VERSION=3.46.1-7+deb13u2
ARG LIBSSL_VERSION=3.5.7-1~deb13u3
ARG OPENSSL_LEGACY_VERSION=3.5.7-1~deb13u3
ARG PERL_BASE_VERSION=5.40.1-6+deb13u1
ARG NPM_BRACE_EXPANSION_VERSION=5.0.12
ARG NPM_UNDICI_VERSION=6.28.1

USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      "gzip=${GZIP_VERSION}" \
      "libpcre2-8-0=${PCRE2_VERSION}" \
      "libsqlite3-0=${SQLITE3_VERSION}" \
      "libssl3t64=${LIBSSL_VERSION}" \
      "openssl-provider-legacy=${OPENSSL_LEGACY_VERSION}" \
      "perl-base=${PERL_BASE_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' gzip)" = "${GZIP_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' libpcre2-8-0)" = "${PCRE2_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' libsqlite3-0)" = "${SQLITE3_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' libssl3t64)" = "${LIBSSL_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' openssl-provider-legacy)" = "${OPENSSL_LEGACY_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' perl-base)" = "${PERL_BASE_VERSION}"; \
    rm -rf /var/lib/apt/lists/*
RUN npm install --global --ignore-scripts npm@11.21.0 --no-audit --no-fund \
    && test "$(npm --version)" = "11.21.0" \
    && mkdir -p /tmp/npm-security \
    && brace_tgz="$(npm pack --silent --pack-destination /tmp/npm-security "brace-expansion@${NPM_BRACE_EXPANSION_VERSION}")" \
    && undici_tgz="$(npm pack --silent --pack-destination /tmp/npm-security "undici@${NPM_UNDICI_VERSION}")" \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/undici \
    && mkdir -p /usr/local/lib/node_modules/npm/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/undici \
    && tar -xzf "/tmp/npm-security/${brace_tgz}" -C /usr/local/lib/node_modules/npm/node_modules/brace-expansion --strip-components=1 \
    && tar -xzf "/tmp/npm-security/${undici_tgz}" -C /usr/local/lib/node_modules/npm/node_modules/undici --strip-components=1 \
    && rm -rf /tmp/npm-security \
    && test "$(node -p "require('/usr/local/lib/node_modules/npm/node_modules/brace-expansion/package.json').version")" = "${NPM_BRACE_EXPANSION_VERSION}" \
    && test "$(node -p "require('/usr/local/lib/node_modules/npm/node_modules/undici/package.json').version")" = "${NPM_UNDICI_VERSION}" \
    && node -e "require('/usr/local/lib/node_modules/npm/node_modules/brace-expansion')" \
    && node -e "require('/usr/local/lib/node_modules/npm/node_modules/undici')" \
    && test "$(npm --version)" = "11.21.0" \
    && npm cache clean --force

WORKDIR /usr/src/app
RUN chown node:node /usr/src/app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY --chown=node:node . .

USER node

CMD ["npm", "test"]

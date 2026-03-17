FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY api/package.json api/package-lock.json ./api/
RUN npm ci \
    && npm --prefix api ci

COPY . .
RUN npm run build:ui \
    && npm run build:api

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    MATRIX_ENV=production \
    MATRIX_UI_USE_DEV_SERVER=false

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY api/package.json api/package-lock.json ./api/
RUN npm --prefix api ci --omit=dev

COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/app/static ./app/static
COPY README.md ./README.md

EXPOSE 8000

CMD ["node", "api/dist/index.js"]

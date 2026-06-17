FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV EXPO_NO_TELEMETRY=1
ENV CI=1

COPY package*.json ./
COPY expo-app/package*.json ./expo-app/

RUN npm ci && npm --prefix expo-app ci


FROM node:22-bookworm-slim AS web-build

WORKDIR /app

ENV NODE_ENV=production
ENV EXPO_NO_TELEMETRY=1
ENV CI=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/expo-app/node_modules ./expo-app/node_modules
COPY . .

RUN rm -rf expo-app/dist expo-app/.expo \
  && npm --prefix expo-app run export:web


FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV EXPO_NO_TELEMETRY=1
ENV CI=1
ENV FUZI_API_PORT=5000
ENV FUZI_DB_PATH=/data/fuzi.sqlite3

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && ln -sf /usr/bin/python3 /usr/local/bin/python \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=web-build /app/server ./server
COPY --from=web-build /app/expo-app/dist ./expo-app/dist
COPY --from=web-build /app/docs ./docs
COPY --from=web-build /app/costing_reference_data.py ./costing_reference_data.py

EXPOSE 5000

CMD ["npm", "run", "prod"]

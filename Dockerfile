FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV EXPO_NO_TELEMETRY=1
ENV CI=1

COPY package*.json ./
COPY expo-app/package*.json ./expo-app/

RUN npm ci && npm --prefix expo-app ci

COPY . .

RUN npm --prefix expo-app run export:web

EXPOSE 5000

CMD ["npm", "run", "prod"]

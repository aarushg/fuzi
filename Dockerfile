FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development
ENV EXPO_NO_TELEMETRY=1
ENV CI=1

COPY package*.json ./
COPY expo-app/package*.json ./expo-app/

RUN npm ci && npm --prefix expo-app ci

COPY . .

EXPOSE 5000 8082
VOLUME ["/data"]

CMD ["npm", "run", "api"]

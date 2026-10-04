# Olive Pizza canonical backend - optional production container
FROM node:20-alpine

WORKDIR /app

# Native build tools are needed by some Node packages during npm ci.
RUN apk add --no-cache python3 make g++ curl

COPY package*.json ./

# tsx is a runtime dependency so the container can execute the existing
# TypeScript backend without changing the application's source/build system.
RUN npm ci --omit=dev && npm cache clean --force

COPY tsconfig.json ./
COPY schema.sql ./
COPY server.ts ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=5000

# Do not run the API as root.
RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:5000/health/live > /dev/null || exit 1

CMD ["node_modules/.bin/tsx", "server.ts"]

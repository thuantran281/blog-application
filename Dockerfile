# syntax=docker/dockerfile:1

FROM node:24-alpine AS client-build

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM node:24-alpine AS server-build

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV CLIENT_DIST_PATH=/app/public

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/db ./db
COPY --from=server-build /app/server/scripts ./scripts
COPY --from=client-build /app/client/dist ./public

EXPOSE 8080

CMD ["node", "dist/server.js"]

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY data ./data
COPY templates ./templates
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY data ./data
COPY templates ./templates
ENTRYPOINT ["node", "dist/src/cli.js"]

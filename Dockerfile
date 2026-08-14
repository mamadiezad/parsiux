FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY data ./data
COPY templates ./templates
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY data ./data
COPY templates ./templates
ENTRYPOINT ["node", "dist/src/cli.js"]

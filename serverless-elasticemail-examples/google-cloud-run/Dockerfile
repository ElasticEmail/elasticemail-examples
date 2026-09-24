# `gcloud run deploy --source .` builds this file with Cloud Build.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Cloud Run sets PORT (8080 by default); the server reads it at startup.
EXPOSE 8080
USER node
CMD ["node", "dist/index.js"]

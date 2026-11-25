FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.22.3-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV MEDIA_STORAGE_ROOT=/var/lib/inrole/media
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /var/lib/inrole/media /var/lib/inrole/erasures && chown -R node:node /var/lib/inrole
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]

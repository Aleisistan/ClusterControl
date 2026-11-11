FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY runtime-config.json.template /etc/clustercontrol/runtime-config.json.template
COPY --chmod=755 docker-entrypoint/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80
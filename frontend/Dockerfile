FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG API_URL=http://192.168.2.63:3000
ARG CAMERA_1_URL=http://192.168.2.57:81/stream
ARG CAMERA_2_URL=http://live1.tusten.no:8080/axis-cgi/mjpg/video.cgi

RUN cat > src/environments/environment.prod.ts <<EOF
export const environment = {
  production: true,
  apiUrl: '${API_URL}',
  camera1Url: '${CAMERA_1_URL}',
  camera2Url: '${CAMERA_2_URL}'
};
EOF

RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
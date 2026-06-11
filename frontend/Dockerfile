FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .
ENV NG_CLI_ANALYTICS=false

EXPOSE 4200

CMD ["npm", "start", "--", "--host", "0.0.0.0"]
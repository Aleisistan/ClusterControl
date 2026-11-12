FROM node:22.22.3

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "simulator.js"]
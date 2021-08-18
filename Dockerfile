FROM node:12

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src /app/src
COPY static /app/static
COPY webpack.server.config.js /app/webpack.server.config.js

RUN ls -a

RUN npm install
RUN npm run build

EXPOSE $PORT

CMD [ "node", "./build/server.js" ]
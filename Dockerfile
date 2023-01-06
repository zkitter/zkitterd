FROM node:16-alpine

RUN apk update
RUN apk add bash
RUN npm i -g pnpm

WORKDIR app

COPY static static
COPY lib lib
COPY .npmrc tsconfig.json webpack.server.config.js ./
COPY package.json pnpm-lock.yaml ./
RUN pnpm i --frozen-lockfile --shamefully-hoist --reporter=silent

COPY gun.db ./
COPY src src

RUN pnpm run build
EXPOSE 3000

CMD [ "pnpm", "start" ]

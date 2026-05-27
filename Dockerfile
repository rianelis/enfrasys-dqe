FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:container

ENV PORT=4100
ENV HOST=0.0.0.0
EXPOSE 4100

CMD ["npm", "start"]

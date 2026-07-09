FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json ./client/package.json
RUN npm install -w client
COPY client ./client
WORKDIR /app/client
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

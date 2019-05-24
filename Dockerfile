FROM node:9-alpine
COPY . /app
WORKDIR /app
RUN npm install --registry=https://registry.npm.taobao.org
EXPOSE 3030
CMD ["npm", "start"]
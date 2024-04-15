FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
EXPOSE 8888
EXPOSE 1883
CMD ["npm", "start"]

# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm i -g @nestjs/cli
COPY . .
RUN nest build

# Prod stage
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm install --only=production
EXPOSE 80

# Add labels for project identification
LABEL org.opencontainers.image.project_id="mytegroup-api-property-management-platform"
LABEL org.opencontainers.image.organization="Mytegroup" 

CMD ["node", "dist/main.js"]

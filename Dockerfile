# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
USER node
CMD [ "node", "dist/main.js" ]

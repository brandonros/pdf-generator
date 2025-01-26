# Build stage
FROM zenika/alpine-chrome:124-with-node AS builder
WORKDIR /app
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM zenika/alpine-chrome:124-with-node
WORKDIR /app
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --production
COPY --from=builder /app/dist ./dist
CMD [ "node", "dist/main.js" ]

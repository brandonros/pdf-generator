# Build stage
FROM zenika/alpine-chrome:124-with-node AS builder
WORKDIR /app
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM zenika/alpine-chrome:124-with-node
WORKDIR /app
RUN chown -R chrome:chrome /app
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
USER chrome
RUN npm install --production
COPY --from=builder /app/dist ./dist
RUN chown -R chrome:chrome ./dist
CMD [ "node", "dist/main.js" ]

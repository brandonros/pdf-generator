FROM node:22-alpine
# Create app directory
WORKDIR /app
# Install app dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install
# Bundle app source
COPY . .
# Build app
RUN npm run build
# Switch to non-root user
USER node
# Export command
CMD [ "node", "dist/main.js" ]

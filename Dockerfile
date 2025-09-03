# Lightweight Docker image for running the API and its tests
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Copy source code
COPY . .

# Default command runs tests; override with `-e CMD=start` to run the app
CMD ["npm", "test"]
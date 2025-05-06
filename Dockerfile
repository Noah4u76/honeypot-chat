FROM node:18

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with explicit CI mode
RUN npm ci

# Copy application code
COPY Server/ ./server/
COPY client/ ./client/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
# MongoDB URI should be set in Railway project variables, not in Dockerfile

EXPOSE 8080

CMD ["node", "server/server.js"] 
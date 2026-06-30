# Use standard LTS Node.js alpine image
FROM node:20-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose port (Cloud Run sets PORT env var automatically, we default to 8080)
EXPOSE 8080

# Run the server
CMD ["node", "server.js"]

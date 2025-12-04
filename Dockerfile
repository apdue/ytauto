FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=5001

# Install system dependencies including FFmpeg
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Verify installations
RUN node --version && \
    npm --version && \
    ffmpeg -version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install backend dependencies
RUN npm install

# Install frontend dependencies
RUN cd frontend && npm install

# Copy all application code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Create necessary directories
RUN mkdir -p data/uploads data/output

# Expose port
EXPOSE 5001

# Start the application
CMD ["node", "backend/server.js"]


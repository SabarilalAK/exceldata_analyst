# Multi-stage production Dockerfile combining Node.js Express API and Python 3 Data Analytics
FROM node:20-slim

# Install Python 3, pip, and system libraries required for matplotlib/pandas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    libfreetype6-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install Python dependencies for data analysis and visualization
RUN pip3 install --no-cache-dir --break-system-packages \
    pandas==2.2.1 \
    numpy==1.26.4 \
    matplotlib==3.8.3 \
    seaborn==0.13.2 \
    openpyxl==3.1.2

# Copy backend application code
COPY . .

# Expose backend port
EXPOSE 5000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["node", "server.js"]

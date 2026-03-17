# Use an official Node.js Alpine image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Install git, build tools, and Chromium for Puppeteer stealth browser (BTDigg)
RUN apk add --no-cache \
    git \
    curl \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip downloading its own Chromium (incompatible with Alpine/musl)
# and use the system-installed one instead
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Copy only dependency files first (better layer caching)
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm and then dependencies
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

# Copy rest of the project files
COPY . .

# Create data directory and set ownership for non-root user
RUN mkdir -p /app/data /app/performance_cache && chown -R node:node /app

# Expose app port (keep whatever your app actually listens on)
EXPOSE 55771

# Run as non-root user
USER node

# Start the dev / app server
CMD ["npm", "run", "start"]

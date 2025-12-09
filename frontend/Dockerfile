FROM node:18-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy only package files first (for better caching)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Don't copy source files - they'll be mounted via volume
# This allows hot reload to work properly

EXPOSE 3002

CMD ["pnpm", "dev"]

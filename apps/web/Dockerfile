# Dockerfile for Web Application (React + Vite)
# Multi-stage build

# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with retry and cache support to survive transient registry resets
RUN --mount=type=cache,target=/root/.npm \
  npm config set fetch-retries 5 && \
  npm config set fetch-retry-factor 2 && \
  npm config set fetch-retry-mintimeout 20000 && \
  npm config set fetch-retry-maxtimeout 120000 && \
  npm config set maxsockets 1 && \
  npm install --legacy-peer-deps --no-audit --no-fund --prefer-offline

# Copy source
COPY . .

# Build application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/index.html || exit 1

EXPOSE 5173

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

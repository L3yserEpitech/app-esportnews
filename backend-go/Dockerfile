# Build stage
FROM golang:alpine AS builder

WORKDIR /build

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY backend-go/go.mod backend-go/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY backend-go/ .

# Build binary (static compilation, optimized for size)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server && \
    ls -la /build/server

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install runtime dependencies (only ca-certificates for HTTPS)
RUN apk add --no-cache ca-certificates

# Copy binary from builder
COPY --from=builder /build/server .

# Set permissions
RUN chmod +x /app/server && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 4000

# Run server
CMD ["./server"]

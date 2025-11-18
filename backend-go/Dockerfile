# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /build

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build binary (static compilation, no CGO needed)
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates postgresql-client

# Copy binary from builder
COPY --from=builder /build/server .

# Copy migrations
COPY migrations ./migrations

# Copy .env if exists
COPY .env* ./

# Expose port
EXPOSE 4000

# Run server
CMD ["./server"]

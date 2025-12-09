# Build stage
FROM golang:alpine AS builder

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
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server && \
    ls -la /build/server

# Build seed binary
RUN CGO_ENABLED=0 GOOS=linux go build -o seed ./cmd/seed && \
    ls -la /build/seed

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates postgresql-client

# Copy binaries from builder
COPY --from=builder /build/server .
COPY --from=builder /build/seed .

# Verify binaries are present
RUN ls -la /app/ && \
    test -f /app/server && \
    test -f /app/seed && \
    chmod +x /app/server /app/seed

# Copy migrations and migration script
COPY migrations ./migrations
COPY run-migrations.sh ./run-migrations.sh
RUN chmod +x ./run-migrations.sh

# Copy initial data for seeding
COPY initial_data ./initial_data

# Copy .env if exists
COPY .env* ./

# Expose port
EXPOSE 4000

# Run server
CMD ["./server"]

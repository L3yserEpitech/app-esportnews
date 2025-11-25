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

# Build seed binary
RUN CGO_ENABLED=0 GOOS=linux go build -o seed ./cmd/seed

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates postgresql-client

# Copy binaries from builder
COPY --from=builder /build/server .
COPY --from=builder /build/seed .

# Copy migrations
COPY migrations ./migrations

# Copy initial data for seeding
COPY initial_data ./initial_data

# Copy .env if exists
COPY .env* ./

# Expose port
EXPOSE 4000

# Run server
CMD ["./server"]

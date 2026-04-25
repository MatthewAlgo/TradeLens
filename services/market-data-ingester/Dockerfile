FROM golang:1.26-alpine AS builder

WORKDIR /build

# Copy go mod files and download dependencies
COPY services/market-data-ingester/go.mod services/market-data-ingester/go.sum* ./
RUN go mod download

# Copy source code
COPY services/market-data-ingester/ .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /ingester ./cmd/ingester

# Runtime image
FROM alpine:3.20

RUN apk --no-cache add ca-certificates
COPY --from=builder /ingester /usr/local/bin/ingester

ENTRYPOINT ["ingester"]

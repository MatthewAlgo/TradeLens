FROM golang:1.26-alpine AS builder

WORKDIR /build

COPY services/aggregator/go.mod services/aggregator/go.sum* ./
RUN go mod download

COPY services/aggregator/ .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /aggregator ./cmd/aggregator

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /aggregator /usr/local/bin/aggregator
ENTRYPOINT ["aggregator"]

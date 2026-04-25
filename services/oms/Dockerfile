FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY services/oms/go.mod services/oms/go.sum* ./
RUN go mod download
COPY services/oms/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /oms ./cmd/oms

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /oms /usr/local/bin/oms
EXPOSE 4001
ENTRYPOINT ["oms"]

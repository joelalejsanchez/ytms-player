# Stage 1: Build Go Binary
FROM golang:1.23-alpine AS builder

WORKDIR /build

COPY go.mod ./
COPY src ./src

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /build/ytms-player-go ./src

# Stage 2: Runtime ligero con yt-dlp y ffmpeg
FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    ffmpeg \
    python3 \
    py3-pip \
    tzdata \
    wget \
    && pip3 install --no-cache-dir --break-system-packages yt-dlp \
    && adduser -D -u 10001 ytmsplayer

WORKDIR /app

COPY --from=builder /build/ytms-player-go /app/ytms-player-go

RUN mkdir -p /app/workspace /app/config \
    && chown -R ytmsplayer:ytmsplayer /app

USER ytmsplayer

EXPOSE 8080

ENV PORT=8080 \
    CONTAINER_WORKSPACE_PREFIX=/app/workspace \
    COOKIES_FILE=/app/config/cookies.txt \
    MAX_WORKERS=3

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["/app/ytms-player-go"]

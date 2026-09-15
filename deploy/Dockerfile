# syntax=docker/dockerfile:1
# Stage 1: build the Next.js static export
FROM node:20-slim AS web
WORKDIR /src/web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# Stage 2: build the static Go binary (embeds web/out)
FROM golang:1.22 AS go
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY --from=web /src/web/out ./web/out
COPY --from=web /src/web/out ./internal/ui/web/out
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /bin/flagsapi ./cmd/flagsapi

# Stage 3: single-process runtime image
FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=go /bin/flagsapi /app/flagsapi
COPY assets/ /app/assets/
EXPOSE 8080
ENTRYPOINT ["/app/flagsapi", "-assets", "/app/assets", "-addr", ":8080"]

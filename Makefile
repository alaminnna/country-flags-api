.PHONY: web build run dev deploy bench test clean sync-ui

# Build the Next.js static export into web/out
web:
	cd web && npm install --no-audit --no-fund && npm run build

# Copy the static export into the Go embed dir (go:embed all:web/out)
sync-ui:
	rm -rf internal/ui/web/out
	mkdir -p internal/ui/web
	cp -r web/out internal/ui/web/out

# Static binary with embedded UI (run `make web sync-ui` first, or use build-all)
build: sync-ui
	CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/flagsapi ./cmd/flagsapi

# web + build in one step
build-all: web build

run: build
	./bin/flagsapi -assets ./assets

# Dev: Go API on :8080 + Next dev on :3000 (rewrites proxy /api + /assets)
dev:
	@echo "starting Go API on :8080 and Next dev on :3000 (Ctrl-C to stop)"
	@(go run ./cmd/flagsapi -addr :8080 & echo $$! > .api.pid; cd web && npm run dev; kill `cat ../.api.pid`)

deploy:
	@test -n "$(DEPLOY_HOST)" || (echo "set DEPLOY_HOST=user@host"; exit 1)
	rsync -az --delete --exclude node_modules --exclude .next ./ $(DEPLOY_HOST):/opt/flagsapi/src/
	ssh $(DEPLOY_HOST) 'cd /opt/flagsapi/src && rsync -a assets/ /opt/flagsapi/assets/ && make build-all && sudo systemctl restart flagsapi'

bench:
	bash deploy/benchmark.sh

test:
	go test ./...

clean:
	rm -rf bin .api.pid

.PHONY: install test test-backend test-frontend coverage run-backend run-frontend docker-build docker-run

install:
	cd frontend && npm ci

test: test-backend test-frontend

test-backend:
	cd backend && go vet ./... && go test -race ./...

test-frontend:
	cd frontend && npm run typecheck && npm test

# Regenerates the committed reports in ./coverage
coverage:
	mkdir -p coverage
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out > ../coverage/backend.txt && go tool cover -html=coverage.out -o ../coverage/backend.html
	cd frontend && npx vitest run --coverage --coverage.reporter=text > ../coverage/frontend.txt

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

docker-build:
	docker build -t sezzle-calculator .

docker-run: docker-build
	docker run --rm -p 8080:8080 sezzle-calculator

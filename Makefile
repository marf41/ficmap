.PHONY: static

run:
	go run .

imports:
	go get -u ./...

static:
	env CGO_ENABLED=0 GOOS=linux go build -a -ldflags '-extldflags "-static"' .

sync: static
	scp ficmap ovh:/tmp/
	scp -r static ovh:/tmp/

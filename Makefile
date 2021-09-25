.PHONY: ficmap

run:
	go run .

imports:
	go get -u ./...

static: ficmap

ficmap:
	# env CGO_ENABLED=0 GOOS=linux go build -a -ldflags '-extldflags "-static"' .
	env GOOS=linux go build -a -ldflags '-extldflags "-static"' -tags netgo,sqlite_omit_load_extension .

sync: ficmap files
	scp ficmap ovh:/tmp/

files:
	scp -r static ovh:/tmp/

loop:
	reflex -d none -g '*.go' -s make run

fzf:
	cat list | fzf --preview="watch curl -s localhost:3033{1}" --preview-window="down:wrap" \
		--bind 'ctrl-j:preview:curl -s localhost:3033{1} | jq .' \
		--bind 'ctrl-v:preview:curl -v -# localhost:3033{1}' \
		--bind 'pgup:preview-half-page-up' \
		--bind 'pgdn:preview-half-page-down' \
		| make fzf


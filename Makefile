test:
	@./node_modules/.bin/mocha

bench:
	@node bench.js

.PHONY: test bench

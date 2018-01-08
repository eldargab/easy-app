test:
	@./node_modules/.bin/mocha -R dot


bench:
	@node bench/bench.js


.PHONY: test bench

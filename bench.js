var Bench = require('benchmark')
var app = require('./index')()

app
.set('one', 1)
.set('two', 2)
.set('three', 3)
.set('four', 4)
.set('five', 5)
.def('onedep', function(one) {
  return one
})
.def('fivedeps', function(one, two, three, four, five) {
  return one
})
.def('a', function() {
  return 'a'
})
.def('b', function() {
  return 'b'
})
.def('ab', function(a, b) {
  return a + b
})
.def('async', function(two, done) {
  done(null, two)
})
.def('bone', function(b, one) {
  return b + one
})
.def('computation', function(bone, async, ab, done) {
  done(null, bone + async + ab)
})

function noop() {}


var suite = new Bench.Suite

suite.add('1 dep', function() {
  app.run().eval('onedep', noop)
})

suite.add('5 deps', function() {
  app.run().eval('fivedeps', noop)
})

suite.add('computation', function() {
  app.run().eval('computation', noop)
})

suite.on('cycle', function(ev, bench) {
  console.log(String(ev.target))
})

suite.run({async: true})

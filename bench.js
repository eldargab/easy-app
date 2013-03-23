var Bench = require('benchmark')
var app = require('./index')()

app
.set('one', 1)
.set('two', 2)
.set('three', 3)
.set('four', 4)
.set('five', 5)
.def('1 dep', function (one) {
  return one
})
.def('5 deps', function (one, two, three, four, five) {
  return one
})

function noop () {}



var suite = new Bench.Suite

suite.add('1 dep', function () {
  app.run().eval('1 dep', noop)
})

suite.add('5 deps', function () {
  app.run().eval('5 deps', noop)
})

suite.on('cycle', function (ev, bench) {
  console.log(String(ev.target))
})

suite.run({async: true})

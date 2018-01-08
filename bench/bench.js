const assert = require('assert')
const Bench = require('benchmark')
const go = require('go-async')
const App = require('..')

const app = new App
const suite = new Bench.Suite


function toFuture(val) {
  let future = new go.Future
  future.done(null, val)
  return future
}


function expect(result, future) {
  if (future.error) throw err
  assert.equal(future.value, result)
}


app.def('i1', (si1) => si1)
app.def('i2', (si2) => si2)
app.def('i3', (si3) => si3)
app.def('i4', (si4) => si4)
app.def('i12', (i1, i2) => i1 + i2)
app.def('i34', (i3, i4) => i3 + i4)
app.def('i1234', (i12, i34) => i12 + i34)

app.def('j1', (sj1) => sj1)
app.def('j2', (sj2) => sj2)
app.def('j3', (sj3) => sj3)
app.def('j4', (sj4) => sj4)
app.def('j12', (j1, j2) => j1 + j2)
app.def('j34', (j3, j4) => j3 + j4)
app.def('j1234', (j12, j34) => j12 + j34)

app.def('ij', (i1234, j1234) => i1234 + j1234)

app.level('I' , 'i1234', ['si1', 'si2', 'si3', 'si4'])
app.level('IJ', 'ij'   , ['si1', 'si2', 'si3', 'si4', 'sj1', 'sj2', 'sj3', 'sj4'])

const I  = app.compile('I')
const IJ = app.compile('IJ')


suite.add('7 sync tasks', function() {
  expect(10, I(1, 2, 3, 4))
})


suite.add('15 sync tasks', function() {
  expect(20, IJ(1, 2, 3, 4, 1, 2, 3, 4))
})


suite.add('4 semi async tasks as a bin tree leafs', function() {
  expect(10, I(toFuture(1), toFuture(2), toFuture(3), toFuture(4)))
})


suite.add('4 async tasks as a bin tree leafs', function() {
  let s1 = new go.Future
  let s2 = new go.Future
  let s3 = new go.Future
  let s4 = new go.Future
  let result = I(s1, s2, s3, s4)
  s1.done(null, 1)
  s2.done(null, 2)
  s3.done(null, 3)
  s4.done(null, 4)
  expect(10, result)
})

suite.add('8 async tasks as a bin tree leafs', function() {
  let si1 = new go.Future
  let si2 = new go.Future
  let si3 = new go.Future
  let si4 = new go.Future
  let sj1 = new go.Future
  let sj2 = new go.Future
  let sj3 = new go.Future
  let sj4 = new go.Future
  let result = IJ(si1, si2, si3, si4, sj1, sj2, sj3, sj4)
  si1.done(null, 1)
  si2.done(null, 2)
  si3.done(null, 3)
  si4.done(null, 4)
  sj1.done(null, 1)
  sj2.done(null, 2)
  sj3.done(null, 3)
  sj4.done(null, 4)
  expect(20, result)
})


suite.on('cycle', function(ev, bench) {
  console.log(String(ev.target))
})

suite.run()
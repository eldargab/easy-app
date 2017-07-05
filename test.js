const App = require('./index')

let app = new App

app.set('a', 'a')

app.def('b', () => 'b')

app.def('ab', function(a, b) {
  return a + b
})

app.def('abc', function(ab, c) {
  return ab + c
})

app.level('clevel', 'abc', ['c'])

app.def('ccc', function*(clevel) {
  let c = yield clevel('c')
  let cc = yield clevel('ccc')
  return c + cc
})

app.level('main', 'ccc')

console.log(app.toJS('main'))
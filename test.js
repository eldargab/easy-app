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

app.level('Abc', 'abc', ['c'])

app.def('ccc', function*(Abc) {
  let c = yield Abc('c')
  let cc = yield Abc('ccc')
  return c + cc
})

app.level('Main', 'ccc')

console.log(app.toJS('Main'))
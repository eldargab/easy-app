# easy-app

Easy-app is based on the idea, that you can structure many computations as a list of
interdependent tasks. It does essentially the same thing as build tools like
`make`, `rake` and numerous IoC containers - abstracts away the
problem of execution order and caching. However, there is a novel part as well.

Unlike other IoC systems, it supports multiple runtime levels. That
means, you can have, for example, a http handler, which can seamlessly and
simultaneously request as a dependency `database` (app level),
`parsed request body` (request level), `cookies` (request level), etc.

Here is an example.

```javascript
var App = require('easy-app')
var app = new App

app.set('a', 1)

app.set('b', 2)

app.def('ab', function(a, b) {
  return a + b
})

app.def('d', function(c) {
  return c
})

app.def('cd', function(c, d) {
  return c + d
})

app.def('abcd', function(ab, cd) {
  return ab + cd
})

app.level('abcd', ['c']) // mark `abcd` as a level with seed `c`

app.def('main', function*(ab, abcd) {
  console.log(ab)
  console.log(yield abcd({c: 1}))
  console.log(yield abcd({c: 2}))
})

app.run() // prints 3 lines (3, 5, 7)
```

## Installation

via npm

```
npm install easy-app
```

## Special thanks

This work initially inspired by
[The-Kiln](https://github.com/straszheimjeffrey/The-Kiln)

## License

(The MIT License)

Copyright (c) 2013 Eldar Gabdullin <eldargab@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

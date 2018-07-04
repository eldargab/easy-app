# easy-app

This library suggests programming model with the same
core idea as found in DI containers and build systems like make.
However here we refine the definition of typical container to
allow much more effective and broad usage.

## Programming model

Application (or any complex function) is described as a set
of global names, where the value of each name can be defined in following 3 ways:

  * As a constant
  * As a function, which can accept as arguments values of other names
  * As a level (A tuple of main value and a list of seeds)

The definition above is best made clear by an example.

```javascript
const App = require('easy-app')

let app = new App

app.def('a', () => 'a')

app.def('ab', (a, b) => a + b)

app.level('Ab', 'ab', ['b'])

app.def('abc', (Ab, c) => Ab('BB') + Ab('bb') + c)

app.level('Abc', 'abc', ['c'])

let abc = app.compile('Abc')

abc('C') // => 'aBBabbC'
```

## Installation

Not yet released.

## Special thanks

This work initially inspired by
[The-Kiln](https://github.com/straszheimjeffrey/The-Kiln)

## License

(The MIT License)

Copyright (c) 2018 Eldar Gabdullin <eldargab@gmail.com>

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

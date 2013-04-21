# easy-app

Easy-app is a container for applications. It allows seamless linking of
different parts together in a maner similar to AMD require system. Unlike AMD
it's not just about static dependencies but is also capable to link things from
various runtime levels. It also facilitates composing of app from small
independent pieces.

## Tasks
```javascript
var App = require('easy-app')
var app = App()

app.set('bar', 10)

app.def('baz', function(bar) {
  return bar * 2
})

app.def('foo', function(bar, baz) {
  return bar + baz
})
```

The `.def` method defines what is called task. Once the task and all it's
dependencies were defined we can evaluate it:

```javascript
app.eval('foo', function(err, foo) {
  foo.should.equal(30)
})
```

Task may be async

```javascript
app.def('config', function(done) {
  fs.readFile('config', done)
})
```
So `done` is a special case name meaning node style callback.

You can also define dependencies explicitly:

```javascript
app.def('foo', ['bar', 'baz'], function(bar, baz) {
  return bar + baz
})
```

## Composition

For big applications definition of everything in a single global container is a
bad choice. In fact we want to compose such application from small loosely
coupled pieces with very few things in common. No problem:

```javascript
var subapp = App() // subapp is a normal app

// define tasks as usual
// Note that we are using short names like `req`.
// Not http_request, approval_request, etc
subapp.def('req', function(bar, baz) {})

// Specify missing tasks.
subapp.importing(
  'bar',
  'baz'
)
```
Now we are ready to plug it in a global container:

```javascript
app.install('super', subapp)
```

The above operation just copies everything from subapp to global container with
all names been prefixed with `super_`. So our `req` task turned into

```javascript
app.def('super_req', ['super_bar', 'super_baz'], function(bar, baz) {})
```

After (or before) installation we supposed to define missing `super_bar` and
`super_baz`. If they are global shared dependencies it's better to do that via
aliasing:

```javascript
app
.def('bar', bar)
.def('baz', baz)

app
.install('super', subapp)
.alias('bar', 'super_bar')
.alias('baz', 'super_baz')
// or alternatively
app.install('super', subapp, {
  'bar': 'bar',
  'baz': 'baz'
})
```

But because `.install` setups aliases for undefined imports automatically
we could stick with just `app.install('super', subapp)`

## Layers

Almost always we have to deal with multiple runtime levels. For web
applications they are typically "app" and "request". That's how we do that:

```javascript
app.layer('app') // mark current instance to be app level
app.at('app', function() {
  app.def('config', function(done) {
    readJson('config.json', done)
  })
  app.def('db', function(config) {
    return require('monk')(config.connection_string)
  })
})
app.at('request', function() {
  app.def('session', function(db, req, done) {
    db.loadSession(req.cookie.session, done)
  })
  app.def('user', function(db, session, done) {
    db.loadUser(session.username, done)
  })
})
// ...
http.createServer(function(req, res) {
  app
  .run() // create next level instance
  .layer('request')
  .set('req', req) // seed
  .set('res', res)
  .eval('some task')
})
```

`.at('request')`, `.layer('request')` stuff is not really necessary for the
above example.

Another way to attach task to a certain level is:

```javascript
app.def('level', 'task', function(a, b) {})
```

## Notes

### Error handling

All task errors both sync and async are catched. In addition `err._task`
property is set to the name of the task which throwed an error and `err._layer` is set
to the name of the nearest named layer.

### Control flow

All tasks are executed sequentally one after another. Dependencies are evaluated
from left to right. You can rely on that.

It is convenient to specify pre-task things as a additional dependency. For example:

```javascript
app.def('secretDocument', function(authorized, db) {
  return db.getSecret()
})
```

### Evaluation of arbitrary task from within task

There is another special case dependency called `eval`. No surprise that it is
similar to `app.eval()` but can be used within task and works for subapp case
as expected.

```javascript
app
.def('bar', bar)
.def('baz', baz)
.def('exec', function(task, eval, done) {
  eval(task, done)
})
app.run().set('task', 'bar').eval('exec') // bar executed

global
.instal('super', app)
.set('super_task', 'baz')
.eval('super_exec') // super_baz (i.e baz) executed
```

## Doing things by convention

Sometimes you want to do things that while accomplished with
regular API require a lot of repetition. For example add security check for
all tasks with a certain name pattern or define subapp dependency depending on
it's namespace, etc. Eventually `.ontask()`, `.onsubapp()` hooks will be
provided for doing such sort of things, but now only `.onsubapp()` is ready.

```javascript
// Hooks are just a methods, not an events
// .onsubapp() is called after subapp installation but before auto-aliasing
app.onsubapp = function(ns, app) {
  // do your stuff here
  // e.g
  this.def(nsconcat(ns, 'foo'), createFoo(ns))
}
```

In addition there is some reflection API you might find useful:

```javascript
app.importing('foo', 'bar')

app.imports('foo') //=> true
app.imports() //=> ['foo', 'bar']
```

```javascript
app.set('foo', 'foo')
app.alias('bar', 'foo')
app.def('baz', baz)

app.defined('foo') //=> true
app.defined('bar') //=> true
app.defined('baz') //=> true
app.defined('qux') //=> false
```

```javascript
var nsconcat = require('easy-app').nsconcat
var nssuffix = require('easy-app').nssuffix

nsconcat('hello', 'world') //=> 'hello_world'
nsconcat('', 'world') //=> 'world'

nssuffix('hello', 'hello_world') //=> 'world'
nssuffix('foo', 'hello_world') //=> null
```

### .use()

Useful for plugins

```javascript
app.use(function plugin(container, param) {
  container.should.equal(app)
  this.should.equal(app)
  param.should.equal(10)
}, 10)
```

## Installation

via npm

```
npm install easy-app
```

via component

```
component install eldargab/easy-app
```

## Related

[make-flow](https://github.com/eldargab/make-flow) is an util with
similar ideas but intended to be just a simple control flow util rather than a
full blown container.

[easy-web](https://github.com/eldargab/easy-web) is a new web framework under
development on top of easy-app. Nearly ready but completely undocumented.
Ping me if you seriously plan to use easy-app in that context and interested in
some inspiration.

## Special thanks

This work intially inspired by
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


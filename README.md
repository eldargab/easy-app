# easy-app

Easy-app is based on the idea, that you can often structure computations as a list of
interdependent tasks. It does essentially the same thing as build tools like
`make`, `rake` and numerous IoC containers - abstracts away the
problem of execution order and caching. However, there is a novel part as well.
Unlike other IoC systems, it supports multiple runtime levels. This feature allows
to compose the entire application as a plain list of (idempotent) functions.
It's simple. Need a new feature? Don't think! Just throw a couple of functions.

# Example

To illustrate above, lets show how one can implement JSON API for some
social network.

We start with app level settings

```javascript
var App = require('easy-app')
var app = new App

app.set('connectionString', process.env.DB_CONNECTION)

app.def('db', function(connectionString) {
  return open(connectionString)
})
```

Since we are building http server, lets define one

```javascript
app.def('server', function(request) {
  return http.createServer(function(req, res) {
    request({req: req}).get(function(err, response) {
      if (err) response = {status: 500}
      res.writeHead(response.status, response.headers)
      res.end(response.body)
    })
  })
})
```

How is this `request` function is defined? Surprisingly, its just a regular task!

```javascript
app.def('request', function*(route, evaluate, response) {
  try {
    var res = yield evaluate(route.name)
  } catch(e) {
    if (!e.http) throw e
    res = e
  }
  return response({res: res})
})

app.def('route', function(req) {
  return router.match(req)
})

app.level('request', ['req'])
```

The line `app.level('request', ['req'])` says, that the task `request` is
an entry point (main function) of the similarly named level `request`, and that,
this level requires `req` as a seed value, and hence all tasks from this level
can use it.

Our request handling logic is as follows. First we match the http request against
available routes (`route`) to determine the handler task,
then dynamically evaluate it to get the response, and since our serialization steps
could be potentially complex, we put them into container as well and define yet another
level.

```javascript
app.level('response', 'res')

app.def('response', function(req, res) {
  // usual http stuff here
})
```

Now, once we established a foundation, we can go ahead and just enjoy building the app.

```javascript
// HTTP: GET /friends
app.def('friends', function(user, db) {
  return db.getFriendsOf(user)
})

app.def('user', function(mayBeUser) {
  if (mayBeUser) return mayBeUser
  throw error(403) // respond with 403 Forbiden
})

app.def('mayBeUser', function(cookies, db) {
  return cookies.auth && db.getUser(cookies.auth)
})

app.def('cookies', function(req) {
  let cookies = req.headers['cookies']
  return parse(cookies)
})
```

App is ready, we are ready to run.

```javascript
app.def('main', function(server) {
  server.listen(3000)
})

app.run()
```

You see?

## Installation

Not yet released.

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

var should = require('should')
var App = require('../app')
var go = require('go-async')

describe('Easy app', function() {
  var app

  beforeEach(function() {
    app = new App

    app.expect = function(val, done) {
      app.run().get(function(err, ret) {
        if (err) return done(err)
        ret.should.equal(val)
        done()
      })
    }
  })

  it('One layer', function(done) {
    app.set('a', 'a')
    app.def('ab', function(a) {
      return a + 'b'
    })
    app.def('abc', function(ab) {
      return ab + 'c'
    })
    app.def('ababc', function(ab, abc) {
      return ab + abc
    })
    app.def('main', function(ababc) {
      ababc.should.equal('ababc')
      return 1
    })
    app.expect(1, done)
  })

  it('Generator and async', function(done) {
    app.def('a', function*() {
      return Promise.resolve('a')
    })
    app.def('main', function(a) {
      a.should.equal('a')
      return 1
    })
    app.expect(1, done)
  })

  it('Multiple levels', function(done) {
    app.level('request', ['path'])
    app.level('response', ['body'])

    app.def('request', function(path, response) {
      return response({body: path})
    })

    app.def('response', function(path, body, transform) {
      return path + ' ' + transform(body)
    })

    var count = 0
    app.def('transform', function() {
      count++
      return function(x) {
        return x.toUpperCase()
      }
    })

    app.def('main', function*(request) {
      var a = yield request({path: 'a'})
      var b = yield request({path: 'b'})
      a.should.equal('a A')
      b.should.equal('b B')
      count.should.equal(1)
      return 1
    })

    app.expect(1, done)
  })

  it('Dynamic eval', function(done) {
    app.def('a', function() {
      return 'a'
    })
    app.def('b', function() {
      return 'b'
    })
    app.def('main', {uses: ['a', 'b']}, function*(evaluate) {
      var a = yield evaluate('a')
      var b = yield evaluate('b')
      a.should.equal('a')
      b.should.equal('b')
      return 1
    })
    app.expect(1, done)
  })

  it('Lazy arguments', function(done) {
    var called = false
    app.def('a', function() {
      called = true
      return 'a'
    })
    app.def('main', function(a$) {
      called.should.be.false
      debugger
      a$.get(function(err, a) {
        a.should.equal('a')
        called.should.be.true
        done()
      })
    })
    app.run()
  })

  describe('Subapp', function() {
    var sub

    beforeEach(function() {
      sub = new App
    })

    it('mixing', function(done) {
      app.set('a', 'a')
      sub.def('ab', function(a) {
        return a + 'b'
      })
      app.install(sub)
      app.def('main', function(ab) {
        ab.should.equal('ab')
        return 1
      })
      app.expect(1, done)
    })

    it('namespacing', function(done) {
      app.set('a', 1)
      app.set('b', 2)

      sub.level('request', ['req'])
      sub.def('request', function(req) {
        return req * 10
      })
      sub.def('response', function*(request, a, b) {
        var res = yield request({req: 10})
        return res + a + b
      })

      app.level('request', ['req'])
      app.def('request', function(req) {
        return req.toUpperCase()
      })

      app.install('sub', sub)

      app.def('main', function*(sub_response, request, sub_request) {
        var res = yield request({req: 'a'})
        res.should.equal('A')
        sub_response.should.equal(103)
        var subres = yield sub_request({req: 5})
        subres.should.equal(50)
        return 1
      })
      app.expect(1, done)
    })

    it('dynamic eval', function(done) {
      sub.set('a', 'a')
      sub.def('A', {uses: ['a']}, function(evaluate) {
        return evaluate('a')
      })
      app.install('sub', sub)
      app.set('a', 1)
      app.def('main', function(a, sub_A) {
        a.should.equal(1)
        sub_A.should.equal('a')
        return 1
      })
      app.expect(1, done)
    })
  })

  it('Coping', function(done) {
    app.set('a', 'a')
    app.def('A', function(a) {
      return a.toUpperCase()
    })
    var app2 = app.copy()
    app2.set('a', 'b')
    app.def('A', function(a) {
      return a
    })
    app.def('main', function*(A) {
      A.should.equal('a')
      var A2 = yield app2.run('A')
      A2.should.equal('B')
      return 1
    })
    app.expect(1, done)
  })
})

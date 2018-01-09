var should = require('should')
var go = require('go-async')
var App = require('..')


describe('easy-app', function() {
  var app

  beforeEach(function() {
    app = new App

    app.level('Main', 'main')

    app.expect = function(val, done) {
      app.compile('Main')().get(function(err, ret) {
        if (err) return done(err)
        ret.should.equal(val)
        done()
      })
    }
  })


  it('Basic', function(done) {
    app.set('a', 'a')

    app.def('ab', function(a) {
      return a + 'b'
    })

    app.def('abc', function(ab) {
      return ab + 'c'
    })

    app.def('main', function(ab, abc) {
      return ab + abc
    })

    app.expect('ababc', done)
  })


  it('Generator and async', function(done) {
    app.def('a', function*() {
      return Promise.resolve('a')
    })

    app.def('b', () => Promise.resolve('b'))

    app.def('c', function*() {
      return 'c'
    })

    app.def('main', function(a, b, c) {
      return a + b + c
    })

    app.expect('abc', done)
  })


  it('Multiple levels', function(done) {
    app.level('Request', 'request', ['path'])
    app.level('Response', 'response', ['body'])

    app.def('request', function(path, Response) {
      return Response(path)
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

    app.def('main', function*(Request) {
      var a = yield Request('a')
      var b = yield Request('b')
      a.should.equal('a A')
      b.should.equal('b B')
      count.should.equal(1)
      return 1
    })

    app.expect(1, done)
  })


  describe('Dynamic eval', function() {
    it('Basic dynamic call', function(done) {
      let called_a = 0

      app.def('a', function() {
        called_a += 1
        return 'a'
      })

      app.def('main', {uses: ['a']}, function(evaluate) {
        called_a.should.equal(0)
        var future = evaluate('a')
        future.should.be.an.instanceOf(go.Future)
        if (future.error) throw future.error
        called_a.should.equal(1)
        future.value.should.equal('a')
        return 1
      })

      app.expect(1, done)
    })


    it('Should throw on undeclared task', function(done) {
      app.def('a', () => 'a')
      app.def('b', () => 'b')

      app.def('main', {uses: ['a']}, function(evaluate) {
        try {
          evaluate('b')
          should.fail()
        } catch(e) {
          e.message.should.equal("'b' is not declared as a dependency of 'main'")
        }
        return 1
      })

      app.expect(1, done)
    })
  })


  xdescribe('Subapp', function() {
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
})

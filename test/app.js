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
})

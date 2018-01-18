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
          e.message.should.equal("'b' is not declared as used from 'main'")
        }
        return 1
      })

      app.expect(1, done)
    })
  })


  describe('Subapp', function() {
    it('mixing with no namespace', function(done) {
      let sub = new App
      sub.set('a', 'a')
      sub.set('b', 'b')
      sub.def('ab', function(a, b) {
        return a + b
      })

      app.set('b', 'B')
      app.def('main', function(ab) {
        ab.should.equal('ab')
        return 1
      })

      app.install(sub)

      app.expect(1, done)
    })


    it('namespacing', function(done) {
      let sub = new App
      sub.set('a', 'a')
      sub.set('d', 'd')
      sub.def('ab', {pre: ['c', 'd']}, function(a, b) {
        return a + b
      })
      sub.level('Ab', 'ab', ['a', 'b'])

      app.install('sub', sub)

      app.defs.should.have.property('sub_ab').with.properties({
        args: ['sub_a', 'b'],
        pre:  ['c', 'sub_d']
      })

      app.defs.should.have.property('sub_Ab').eql({
        main: 'sub_ab',
        seeds: ['sub_a', 'sub_b']
      })

      app.set('b', 'b')
      app.set('c', 'c')

      app.def('main', function(sub_ab, sub_Ab) {
        return sub_ab + sub_Ab('A').value
      })

      app.expect('abAb', done)
    })


    it('namespacing dynamic eval', function(done) {
      let sub = new App
      sub.set('a', 'a')
      sub.set('b', 'b')
      sub.def('dyn', {uses: ['a', 'b', 'c', 'd']}, function*(evaluate) {
        return (yield evaluate('a')) + (yield evaluate('b')) + (yield evaluate('c')) + (yield evaluate('d'))
      })

      app.set('sub_c', 'c')
      app.set('d', 'd')
      app.install('sub', sub)

      app.defs.should.have.property('sub_dyn').with.properties({
        uses: ['sub a', 'sub b', 'sub c', 'd'],
        args: ['evaluate']
      })

      app.def('main', sub_dyn => sub_dyn)

      app.expect('abcd', done)
    })
  })
})

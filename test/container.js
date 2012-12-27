var should = require('should')
var Log = require('test-log')
var Container = require('..')

describe('Container', function () {
 var app, log

  beforeEach(function () {
    app = new Container
    log = Log()
  })

  describe('.eval(task, [cb])', function () {
    it('Should evaluate task', function (done) {
      app.def('foo', function () {
        return 'bar'
      })
      app.eval('foo', function (err, val) {
        val.should.equal('bar')
        done()
      })
    })

    it('Should treat task with <done> argument as async', function (done) {
      var end
      app.def('foo', function (done) {
        end = done
      })
      app.eval('foo', function (err, val) {
        val.should.equal('ok')
        done()
      })
      end(null, 'ok')
    })

    it('Should call callback with <this> set to <app>', function () {
      app.def('foo', function () {
        return 'bar'
      }).eval('foo', function () {
        this.should.equal(app)
      })
    })

    it('Should evaluate all task dependencies before evaluating task itself', function () {
      var b_end, c_end, d_end

      app
        .def('a', function (b, c, d) {
          log('a')
        })
        .def('b', function (c, done) {
          log('b')
          b_end = done
        })
        .def('c', function (done) {
          log('c')
          c_end = done
        })
        .def('d', function (done) {
          log('d')
          d_end = done
        })
        .eval('a', function () {
          log('done')
        })

      log.should.equal('c')
      c_end()
      log.should.equal('c b')
      b_end()
      log.should.equal('c b d')
      d_end()
      log.should.equal('c b d a done')
    })

    it('Should pass task arguments', function (done) {
      app
        .def('foo', function () {
          return 'foo'
        })
        .def('bar', function () {
          return 'bar'
        })
        .def('foobar', function (foo, bar) {
          foo.should.equal('foo')
          bar.should.equal('bar')
          done()
        })
        .eval('foobar')
    })

    it('Should not evaluate task twice', function () {
      app.def('foo', function () {
        log('foo')
      })
      app.eval('foo')
      log.should.equal('foo')
      app.eval('foo')
      log.should.equal('foo')
    })
  })

  describe('.get(task)', function () {
    it('Should return task value', function () {
      app.def('a', function () {
        return 'b'
      })
      should.not.exist(app.get('a'))
      app.eval('a')
      app.get('a').should.equal('b')
    })
  })

  describe('.set(task, val)', function () {
    it('Should set task value', function () {
      app.set('a', 'b').get('a').should.equal('b')
    })
  })

  describe('Layers', function () {
    it('Task should be bound to its layer', function () {
      app
        .layer('app')
        .def('app', 'setup', function () {
          return 'setup'
        })
        .def('request', 'user', function () {
          return 'user'
        })
        .def('response', function (user, setup) {
          return user + setup
        })

      var req = app.run().layer('request')

      req.eval('response')

      req.get('response').should.equal('usersetup')
      req.get('user').should.equal('user')
      req.get('setup').should.equal('setup')

      app.get('setup').should.equal('setup')
      should.not.exist(app.get('user'))
      should.not.exist(app.get('response'))
    })
  })

  describe('Aliases', function () {
    it('Should work with .get()', function () {
      app.alias('a_b_c', 'c')
      app.set('c', 'foo')
      app.get('a_b_c').should.equal('foo')
    })

    it('Should work with .eval()', function (done) {
      app.alias('a_b_c', 'c')
      app.def('c', function () {
        return 'foo'
      }).eval('a_b_c', function (err, val) {
        val.should.equal('foo')
        done()
      })
    })

    describe('nesting', function () {
      beforeEach(function () {
        app.alias('a_b_c', 'a_c')
        app.alias('a_c', 'c')
      })

      it('Should work with .get()', function () {
        app.set('c', 'foo')
        app.get('a_b_c').should.equal('foo')
      })

      it('Should work with .eval()', function (done) {
        app.def('c', function () {
          return 'foo'
        })
        app.eval('a_b_c', function (err, val) {
          val.should.equal('foo')
          done()
        })
      })
    })
  })

  describe('.install(namespace, app, aliases)', function () {
    it('Should install <app> at <namespace>', function () {
      var subapp = new Container()
        .def('barbaz', function (bar, baz, done) {
          done(null, bar + baz) // should not clobber done() dependency
        })
        .def('bar', function () {
          return 'bar'
        })
        .set('baz', 'baz')

      app.install('super', subapp)

      app.eval('super_barbaz')
      app.get('super_barbaz').should.equal('barbaz')
    })

    it('Should allow to just mix subapp, without namespacing', function () {
      var subapp = new Container()
        .def('barbaz', function (bar, baz) {
          return bar + baz
        })
        .def('bar', function () {
          return 'bar'
        })
        .set('baz', 'baz')

      app.install(subapp)

      app.eval('barbaz')
      app.get('barbaz').should.equal('barbaz')
    })

    it('Should preserve aliases', function () {
      var subapp = new Container()
        .alias('a', 'b')
        .set('b', 10)
      app.install('asd', subapp)
      app.get('asd_a').should.equal(10)
    })

    it('Should setup passed aliases', function () {
      var subapp = new Container()
        .def('barbazqux', function (bar, baz, qux) {
          return bar + baz + qux
        })
        .def('bar', function () {
          return 'bar'
        })

      app.install('super', subapp, {
        baz: 'appbaz',
        qux: '*'
      })

      app.set('appbaz', 'baz')
      app.set('qux', 'qux')

      app.eval('super_barbazqux')
      app.get('super_barbazqux').should.equal('barbazqux')
    })

    it('Should preserve layers', function () {
      var subapp = new Container()
        .def('app','bar', function () {
          return 'bar'
        })
        .def('baz', function (bar) {
          return bar + baz
        })

      app.install('super', subapp)

      app.layer('app')

      var runtime = app.run()

      runtime.eval('super_baz')

      app.get('super_bar').should.equal('bar')
      should.not.exist(app.get('super_baz'))
    })
  })

  describe('eval() within task', function () {
    it('Should evaluate tasks', function (done) {
      app.def('bar', function () {
        return 'foo'
      })
      .def('baz', function (eval, done) {
        eval('bar', done)
      })
      .eval('baz', function (err, val) {
        if (err) return done(err)
        val.should.equal('foo')
        done()
      })
    })

    it('Should work within subapp', function (done) {
      var subapp = Container()
        .def('bar', function () {
          return 'foo'
        })
        .def('baz', function (eval, done) {
          eval('bar', done)
        })

      app.install('qux', subapp)

      app.eval('qux_baz', function (err, val) {
        if (err) return done(err)
        val.should.equal('foo')
        done()
      })
    })

    it('Should work within deep subapp', function (done) {
      var deep = Container()
        .def('bar', function () {
          return 'foo'
        })
        .def('baz', function (eval, done) {
          eval('bar', done)
        })

      var subapp = Container().install('qux', deep)

      app.install('hi', subapp)

      app.eval('hi_qux_baz', function (err, val) {
        if (err) return done(err)
        val.should.equal('foo')
        done()
      })
      })
  })

  describe('Error handling', function () {
    it('Should catch task exceptions', function (done) {
      app.def('error', function () {
        throw new Error('hello')
      }).eval('error', function (err) {
        err.message.should.equal('hello')
        done()
      })
    })

    it('Should wrap non-error exceptions', function (done) {
      app.def('foo', function () {
        throw 'foo'
      }).eval('foo', function (err) {
        err.should.be.an.instanceof(Error)
        err.message.should.equal('foo')
        done()
      })
    })
  })

  describe('.use(plugin)', function () {
    it('Should call plugin with <app> passed in a first arg', function (done) {
      app.use(function (_app) {
        _app.should.equal(app)
        done()
      })
    })
    it('Should pass arguments to the plugin', function (done) {
      app.use(function (app, first, second) {
        first.should.equal('first')
        second.should.equal('second')
        done()
      }, 'first', 'second')
    })
    it('Should return <app>', function () {
      app.use(function () { }).should.equal(app)
    })
  })
})

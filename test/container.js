var should = require('should')
var Log = require('test-log')
var App = require('..')
var nssuffix = App.nssuffix
var nsconcat = App.nsconcat

describe('App', function() {
 var app, log

  beforeEach(function() {
    app = new App
    log = Log()
  })

  describe('.eval(task, [cb])', function() {
    it('Should evaluate task', function(done) {
      app.def('foo', function() {
        return 'bar'
      })
      app.eval('foo', function(err, val) {
        val.should.equal('bar')
        done()
      })
    })

    it('Should treat task with `done` argument as async', function(done) {
      var end
      app.def('foo', function(done) {
        end = done
      })
      app.eval('foo', function(err, val) {
        val.should.equal('ok')
        done()
      })
      end(null, 'ok')
    })

    it('Should evaluate all task dependencies before evaluating task itself', function() {
      var b_end, c_end, d_end

      app
        .def('a', function(b, c, d) {
          log('a')
        })
        .def('b', function(c, done) {
          log('b')
          b_end = done
        })
        .def('c', function(done) {
          log('c')
          c_end = done
        })
        .def('d', function(done) {
          log('d')
          d_end = done
        })
        .eval('a', function() {
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

    it('Should pass task arguments', function(done) {
      app
        .def('foo', function() {
          return 'foo'
        })
        .def('bar', function() {
          return 'bar'
        })
        .def('foobar', function(foo, bar) {
          foo.should.equal('foo')
          bar.should.equal('bar')
          done()
        })
        .eval('foobar')
    })

    it('Should call task with `this` set to `app`', function(done) {
      app.def('foo', function() {
        this.should.equal(app)
        done()
      }).eval('foo')
    })

    it('Should not evaluate task twice', function() {
      app.def('foo', function() {
        log('foo')
      })
      app.eval('foo')
      log.should.equal('foo')
      app.eval('foo')
      log.should.equal('foo')
    })

    it('Should support multiple simultaneous eval requests', function() {
      var fooDone

      app.def('foo', function(done) {
        log('foo')
        fooDone = done
      })

      app.eval('foo', function() {
        log('first')
      })

      app.eval('foo', function() {
        log('second')
      })

      fooDone()

      log.should.equal('foo first second')
    })
  })

  describe('.get(task)', function() {
    it('Should return task value', function() {
      app.def('a', function() {
        return 'b'
      })
      should.not.exist(app.get('a'))
      app.eval('a')
      app.get('a').should.equal('b')
    })
  })

  describe('.set(task, val)', function() {
    it('Should set task value', function() {
      app.set('a', 'b').get('a').should.equal('b')
    })

    it('Should have precedence over aliases', function(done) {
      app.set('b', 'b')
      app.alias('a', 'b')
      app.set('a', 'a')
      app.get('a').should.equal('a')
      app.eval('a', function(err, a) {
        a.should.equal('a')
        app.set('a', undefined)
        app.get('a').should.equal('b')
        done()
      })
    })

    it('Should have precedence over task definitions', function(done) {
      app.def('a', function() {
        return 'b'
      })
      app.set('a', 'a')
      app.get('a').should.equal('a')
      app.eval('a', function(err, a) {
        a.should.equal('a')
        done()
      })
    })
  })

  describe('.def()', function() {
    it('Should clobber previous values', function() {
      app.set('foo', 'bar').def('foo', function() {
        return 'qux'
      })
      should.not.exist(app.get('foo'))
      app.eval('foo')
      app.get('foo').should.equal('qux')
    })

    it('Should clobber previous aliases', function(done) {
      app.set('b', 'b')
      app.alias('a', 'b')
      app.def('a', function() {
        return 'a'
      })
      should.not.exist(app.get('a'))
      app.eval('a', function(err, val) {
        val.should.equal('a')
        done()
      })
    })
  })

  describe('.defined(task)', function() {
    it('Should return true if task is defined', function() {
      app.set('foo', null)
      app.def('bar', function() {})
      app.alias('baz', 'foo')

      app.defined('foo').should.be.true
      app.defined('bar').should.be.true
      app.defined('baz').should.be.true
    })

    it('Should return false otherwise', function() {
      app.defined('baz').should.be.false
    })
  })

  describe('.undefine(task)', function() {
    it('Should delete task definition', function() {
      app.set('foo', 'foo')
      app.def('bar', function() {})
      app.alias('baz', 'foo')

      app.undefine('foo')
      app.undefine('bar')
      app.undefine('baz')

      app.defined('foo').should.be.false
      app.defined('bar').should.be.false
      app.defined('baz').should.be.false
    })
  })

  describe('Aliases', function() {
    it('Should work with .get()', function() {
      app.alias('a_b_c', 'c')
      app.set('c', 'foo')
      app.get('a_b_c').should.equal('foo')
    })

    it('Should work with .eval()', function(done) {
      app.alias('a_b_c', 'c')
      app.def('c', function() {
        return 'foo'
      }).eval('a_b_c', function(err, val) {
        val.should.equal('foo')
        done()
      })
    })

    it('Should clobber previous values', function(done) {
      app.set('a', 'a')
      app.set('b', 'b')
      app.alias('a', 'b')
      app.get('a').should.equal('b')
      app.eval('a', function(err, val) {
        val.should.equal('b')
        done()
      })
    })

    it('Should clobber previous task definitions', function(done) {
      app.def('a', function() {
        return 'a'
      })
      app.set('b', 'b')
      app.alias('a', 'b')
      app.get('a').should.equal('b')
      app.eval('a', function(err, val) {
        val.should.equal('b')
        done()
      })
    })

    describe('nesting', function() {
      beforeEach(function() {
        app.alias('a_b_c', 'a_c')
        app.alias('a_c', 'c')
      })

      it('Should work with .get()', function() {
        app.set('c', 'foo')
        app.get('a_b_c').should.equal('foo')
      })

      it('Should work with .eval()', function(done) {
        app.def('c', function() {
          return 'foo'
        })
        app.eval('a_b_c', function(err, val) {
          val.should.equal('foo')
          done()
        })
      })
    })
  })

  describe('Layers', function() {
    it('Task should be bound to its layer', function() {
      app
        .layer('app')
        .def('app', 'setup', function() {
          this.should.equal(app)
          return 'setup'
        })
        .def('request', 'user', function() {
          this.should.equal(req)
          return 'user'
        })
        .def('response', function(user, setup) {
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

  describe('.at(layer, fn)', function() {
    it('Should bound all tasks to `layer`', function() {
      app.at('app', function(app) {
        app.def('foo', function() {
          return 'foo'
        })
      })
      app.layer('app')
      app.run().eval('foo')
      app.get('foo').should.equal('foo')
    })

    it('Should not clobber layer specified explicitly', function() {
      app.at('app', function(app) {
        app.def('req', 'foo', function() {
          return 'foo'
        })
      })
      app.layer('app')
      var req = app.run().layer('req')
      req.run().eval('foo')
      should.not.exist(app.get('foo'))
      req.get('foo').should.equal('foo')
    })

    it('Should support nesting', function() {
      app.at('app', function(app) {
        app.at('req', function(app) {
          app.def('req', function(env) {
            return 'req'
          })
        })
        app.def('env', function() {
          return 'env'
        })
      })
      app.layer('app')
      var req = app.run().layer('req')
      req.run().eval('req')
      req.get('req').should.equal('req')
      app.get('env').should.equal('env')
    })

    it('Should return `this`', function() {
      app.at('foo', function() {}).should.equal(app)
    })
  })

  describe('.install(namespace, app, aliases)', function() {
    it('Should install `app` at `namespace`', function() {
      var subapp = new App()
        .def('barbaz', function(bar, baz, done) {
          done(null, bar + baz) // should not clobber done() dependency
        })
        .def('bar', function() {
          return 'bar'
        })
        .set('baz', 'baz')

      app.install('super', subapp)

      app.eval('super_barbaz')
      app.get('super_barbaz').should.equal('barbaz')
    })

    it('Should allow to just mix subapp, without namespacing', function() {
      var subapp = new App()
        .def('barbaz', function(bar, baz) {
          return bar + baz
        })
        .def('bar', function() {
          return 'bar'
        })
        .set('baz', 'baz')

      app.install(subapp)

      app.eval('barbaz')
      app.get('barbaz').should.equal('barbaz')
    })

    it('Should allow (null, app) signature', function() {
      var subapp = App().set('foo', 'foo')
      app.install(null, subapp)
      app.get('foo').should.equal('foo')
    })

    it('Should preserve aliases', function() {
      var subapp = new App()
        .alias('a', 'b')
        .set('b', 10)
      app.install('asd', subapp)
      app.get('asd_a').should.equal(10)
    })

    it('Should setup passed aliases', function() {
      var subapp = new App()
        .def('barbaz', function(bar, baz) {
          return bar + baz
        })
        .def('bar', function() {
          return 'bar'
        })

      app.install('super', subapp, {
        baz: 'appbaz'
      })

      app.set('appbaz', 'baz')

      app.eval('super_barbaz')
      app.get('super_barbaz').should.equal('barbaz')
    })

    it('Should auto alias undefined imports', function(done) {
      var subapp = App()
        .importing('foo')
        .def('foobar', function(foo) {
          return foo + 'bar'
        })
      app
      .install('super', subapp)
      .set('foo', 'foo')
      .eval('super_foobar', function(err, val) {
        val.should.equal('foobar')
        done()
      })
    })

    it('Should not auto alias on mixing', function() {
      var subapp = App().importing('foo')
      app.install(subapp)
      should.not.exist(app.aliases.foo)
    })

    it('Should vall `.onsubapp()` after installation but before auto aliasing', function(done) {
      var subapp = App()
        .importing('foo')
        .set('qux', 'qux')

      app.onsubapp = function(ns, sub) {
        sub.should.equal(subapp)
        ns.should.equal('ns')
        this.defined('ns_foo').should.be.false
        this.defined('ns_bar').should.be.true
        this.defined('ns_qux').should.be.true
        done()
      }

      app.install('ns', subapp, {'bar': 'bar'})
    })

    it('Should preserve layers', function() {
      var subapp = new App()
        .def('app','bar', function() {
          return 'bar'
        })
        .def('baz', function(bar) {
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

  describe('.imports()', function() {
    describe('Given a task name', function() {
      it('Should return true if the app imports this task', function() {
        app.importing('foo')
        app.imports('foo').should.be.true
      })

      it('Should return false otherwise', function() {
        app.imports('foo').should.be.false
      })
    })

    describe('Given no arguments', function() {
      it('Should return an array of imports', function() {
        app.importing('a', 'b', 'c')
        app.imports(['a', 'b', 'c'])
      })
    })
  })

  describe('.importing()', function() {
    it('Should register passed tasks as imports', function() {
      app.importing('t1', ['t2', 't3'])
      app.imports().should.eql(['t1', 't2', 't3'])
    })

    it('Should not clobber prototype', function() {
      app.run().importing('foo')
      app.imports('foo').should.be.false
    })
  })

  describe('eval() within task', function() {
    it('Should evaluate tasks', function(done) {
      app.def('bar', function() {
        return 'foo'
      })
      .def('baz', function(eval, done) {
        eval('bar', done)
      })
      .eval('baz', function(err, val) {
        if (err) return done(err)
        val.should.equal('foo')
        done()
      })
    })

    it('Should work within subapp', function(done) {
      var subapp = App()
        .def('bar', function() {
          return 'foo'
        })
        .def('baz', function(eval, done) {
          eval('bar', done)
        })

      app.install('qux', subapp)

      app.eval('qux_baz', function(err, val) {
        if (err) return done(err)
        val.should.equal('foo')
        done()
      })
    })

    it('Should work within deep subapp', function(done) {
      var deep = App()
        .def('bar', function() {
          return 'foo'
        })
        .def('baz', function(eval, done) {
          eval('bar', done)
        })

      var subapp = App().install('qux', deep)

      app.install('hi', subapp)

      app.eval('hi_qux_baz', function(err, val) {
        if (err) return done(err)
        val.should.equal('foo')
        done()
      })
      })
  })

  describe('Error handling', function() {
    it('Should catch task exceptions', function(done) {
      app.def('error', function() {
        throw new Error('hello')
      }).eval('error', function(err) {
        err.message.should.equal('hello')
        done()
      })
    })

    it('Should set `._task` property to the name of throwed task', function(done) {
      app.def('bug', function() {
        var err = new Error('Ups')
        err._task = 'foo'
        throw err
      }).def('task', function(bug) {
        return bug
      }).def('task2', function(bug) {
        return bug
      })
      .eval('task', function(err) {
        err._task.should.equal('bug')
        app.eval('task2', function(err) {
          err._task.should.equal('bug')
          done()
        })
      })
    })

    it('Should set `._task` property to the name of throwed task in case of delegation', function(done) {
      app.def('bug', function() {
        throw new Error('Ups')
      }).def('dispatch', function(eval, done) {
        eval('bug', done)
      })
      .eval('dispatch', function(err) {
        err._task.should.equal('bug')
        done()
      })
    })

    it('Should set `._layer` property the name of the nearest named layer', function(done) {
      app.layer('app')
      app.def('bug', function() {
        var err = new Error('Ups')
        err._layer = 'foo'
        throw err
      }).def('task', function(bug) {
        return bug
      })
      .run()
      .eval('task', function(err) {
        err._layer.should.equal('app')
        done()
      })
    })

    it('Should set `._layer` and `._task` in case of app\'s nesting', function(done) {
      var app2 = App()
      app2.layer('foo')
      app2.def('bug', function() {
        throw new Error('Bug!')
      })

      app.layer('app')
      app.def('task', function(done) {
        app2.eval('bug', done)
      })

      app.eval('task', function(err) {
        err._task.should.equal('task')
        err._layer.should.equal('app')
        done()
      })
    })

    it('Should wrap non-error exceptions', function(done) {
      app.def('foo', function() {
        throw 'foo'
      }).eval('foo', function(err) {
        err.should.be.an.instanceof(Error)
        err.orig.should.equal('foo')
        done()
      })
    })

    it('Should prevent double callbacks', function() {
      var cer = console.error
      after(function() {
        console.error = cer
      })
      var msg
      console.error = function(s) {
        msg = s
      }
      app.def('foo', function(done) {
        done(null, 'foo')
      }).eval('foo', function() {
        throw new Error('Error in eval callback')
      })
      msg.should.match(/^Callback for the task `foo` was called two times/)
      msg.should.match(/Perhaps it is happened due to exception in an eval callback/)
      msg.should.match(/Error in eval callback/)
    })
  })

  describe('.use(plugin)', function() {
    it('Should call plugin with `app` passed in a first arg', function(done) {
      app.use(function(_app) {
        _app.should.equal(app)
        done()
      })
    })
    it('Should pass arguments to the plugin', function(done) {
      app.use(function(app, first, second) {
        first.should.equal('first')
        second.should.equal('second')
        done()
      }, 'first', 'second')
    })
    it('Should return `app`', function() {
      app.use(function() { }).should.equal(app)
    })
  })

  describe('nssuffix', function() {
    it('ns, ns_task -> task', function() {
      nssuffix('ns', 'ns_task').should.equal('task')
    })
    it('ns1, ns2_task -> null', function() {
      should.not.exist(nssuffix('ns1', 'ns2_task'))
    })
    it('null, task -> task', function() {
      nssuffix('', 'task').should.equal('task')
    })
  })

  describe('nsconcat', function() {
    it('ns, task -> ns_task', function() {
      nsconcat('ns', 'task').should.equal('ns_task')
    })
    it('null, task -> task', function() {
      nsconcat('', 'task').should.equal('task')
    })
    it('ns, null -> ns', function() {
      nsconcat('ns', '').should.equal('ns')
    })
  })
})

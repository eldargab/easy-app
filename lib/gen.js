

module.exports = generate


function generate(app) {
  let out = new Out()
  let main = app.defs[app.main]

  app.levels.forEach(function(level) {
    gen_level(out, level)
  })

  out.line()

  out.line(`return function(${main.seeds.join(', ')})`)
  out.block(() => {
    out.line(`return new _${main.name}(${['null'].concat(main.seeds).join(', ')}).main()`)
  })

  return out.toString()
}


function gen_level(out, level) {
  out.line(`function _${level.name}(${['_parent'].concat(level.seeds).join(', ')})`)
  out.block(() => {
    out.line('this.parent = _parent')
    level.seeds.forEach(function(seed) {
      out.line(`this._val_${seed} = ${seed}`)
    })
  })
  out.line()

  level.seeds.forEach(function(seed) {
    gen_constant_getter(out, level, seed)
    out.line()
  })

  level.forEachDefinition(function(name, def) {
    switch(def.type) {
      case 'level':
        gen_level_getter(out, level, name, def)
        break
      case 'fn':
        gen_function(out, level, name, def)
        break
      case 'const':
        out.line(`_${level.name}.prototype._val_${name} = defs.${name}.value`)
        out.line()
        gen_constant_getter(out, level, name)
        break
    }
    out.line()
  })

  level.forEachDependency(function(name) {
    out.line(`_${level.name}.prototype._get_${name} = function()`)
    out.block(() => {
      out.line(`return this.parent._get_${name}()`)
    })
    out.line()
  })


  level.forEachDefinition(function(name, def) {
    if (!def.close) return
    out.line()
    out.line(`_${level.name}.prototype._close_${name} = defs.${name}.close`)
  })

  out.line()

  if (level.hasResources()) {
    out.line(`_${level.name}.prototype.close = function()`)
    out.block(() => {
      level.forEachDefinition(function(name, def) {
        if (!def.close) return
        out.line(`if (this._val_${name}) rt.safecall(this._close_${name}, this._val_${name})`)
      })
    })

    out.line()
  }

  out.line(`_${level.name}.prototype.main = function()`)
  out.block(() => {
    out.line('var future = new rt.Future')
    out.line(`rt.poll(future, this, this._get_${level.main})`)
    if (level.hasResources()) {
      out.line('if (future.ready) { this.close() } else { rt.closeAsync(this, future) }')
    }
    out.line('return future')
  })
}


function gen_constant_getter(out, level, name) {
  out.line(`_${level.name}.prototype._get_${name} = function()`)
  out.block(() => {
    out.line(`return this._val_${name}`)
  })
}


function gen_level_getter(out, level, name, def) {
  out.line(`_${level.name}.prototype._compute_${name} = function()`)
  out.block(() => {
    out.line('var _self = this')
    out.line(`return this._val_${name} = function ${name}(${def.seeds.join(', ')})`)
    out.block(() => {
      out.line(`return new _${name}(${['_self'].concat(def.seeds).join(', ')}).main()`)
    })
  })
  gen_compute_getter(out, level, name)
}


function gen_compute_getter(out, level, name) {
  out.line(`_${level.name}.prototype._get_${name} = function()`)
  out.block(() => {
    out.line(`return this._val_${name} === undefined ? this._compute_${name}() : this._val_${name}`)
  })
}


function gen_function(out, level, name, def) {
  gen_compute_getter(out, level, name)
  out.line()
  out.line(`_${level.name}.prototype._compute_${name} = function()`)
  out.block(() => {
    out.line(`if (this._err_${name}) throw this._err_${name}`)
    out.line(`if (this._fut_${name}) rt.throwNotReady(this._fut_${name})`)
    def.forEachPre(dep => out.line(`this._get_${dep}()`))
    def.forEachArgument(dep => {
      let rhs
      if (dep == 'evaluate') {
        rhs = `rt.getEval(this, '${name}')`
      } else if (dep == 'namespace') {
        rhs = `this._ns_${name}`
      } else if (def.lazy[dep]) {
        rhs = `rt.getLazy(this, this._get_${dep})`
      } else {
        rhs = `this._get_${dep}()`
      }
      out.line(`var _${dep} = ${rhs}`)
    })
    out.line('try')
    out.block(() => {
      out.line(`var val = this._fn_${name}(${def.args.map(a => `_${a}`).join(', ')})`)
    })
    out.line('catch(e)')
    out.block(() => {
      out.line(`this._err_${name} = rt.toError(e)`)
      out.line(`throw this._err_${name}`)
    })
    out.line('if (val == null || !val.__yield_to_go_future)')
    out.block(() => out.line(`this._val_${name} = val === undefined ? null : val`))
    out.line('else')
    out.block(() => {
      out.line(`this._set_async_${name}(val)`)
    })
    out.line(`return this._val_${name}`)
  })
  out.line()
  out.line(`_${level.name}.prototype._set_async_${name} = function(val)`)
  out.block(() => {
    out.line('var future = val.__to_go_future()')
    out.line('if (future.ready)')
    out.block(() => {
      out.line(`if (future.error)`)
      out.block(() => {
        out.line(`this._err_${name} = future.error`)
        out.line('throw future.error')
      })
      out.line(`this._val_${name} = future.value === undefined ? null : future.value`)
    })
    out.line('else')
    out.block(() => {
      out.line(`this._defer_${name}(future)`)
    })
  })
  out.line()
  out.line(`_${level.name}.prototype._defer_${name} = function(future)`)
  out.block(() => {
    out.line(`this._fut_${name} = future`)
    out.line('var self = this')
    out.line('rt.regFuture(self, future)')
    out.line('future.get(function(err, val)')
    out.block(() => {
      out.line('rt.unregFuture(self, future)')
      out.line('if (err)')
      out.block(() => out.line(`self._err_${name} = err`))
      out.line('else')
      out.block(() => out.line(`self._val_${name} = val === undefined ? null : val`))
      out.line(`self._fut_${name} = null`)
    })
    out.line(')')
    out.line('rt.throwNotReady(future)')
  })
  out.line()
  out.line(`_${level.name}.prototype._fn_${name} = defs.${name}.fn`)
  out.line(`_${level.name}.prototype._uses_${name} = defs.${name}.uses`)
  out.line(`_${level.name}.prototype._ns_${name} = defs.${name}.ns || null`)
}


function Out() {
  this.buf = ''
  this.ident = ''
}


Out.prototype.line = function(txt) {
  if (txt != null) {
    this.buf += this.ident + txt
  }
  this.buf += '\n'
}


Out.prototype.block = function(cb) {
  let old = this.ident
  this.line('{')
  this.ident += '  '
  cb()
  this.ident = old
  this.line('}')
}


Out.prototype.toString = function() {
  return this.buf
}
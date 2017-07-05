

module.exports = generate


function generate(app) {
  let out = new Out()

  app.levels.forEach(function(level) {
    gen_level(out, level)
  })

  out.line('let _parent = null')
  out.line('let _app = ')
  gen_level_function(out, app.defs[app.main])
  out.line('return _app')

  return out.toString()
}


function gen_level(out, level) {
  out.line(`function ${level.name}(_parent, ${level.seeds.join(', ')})`)
  out.block(() => {
    out.line('this._parent = _parent')
    level.seeds.forEach(function(seed) {
      out.line(`this.${seed} = ${seed}`)
    })
  })

  out.line()

  level.forEachDefinition(function(name, def) {
    if (def.type == 'level') return
    out.line(`${level.name}.prototype.${name} = _defs.${name}.${def.type == 'const' ? 'value' : 'fn'}`)
  })

  out.line()

  level.forEachRoot(function(root) {
    gen_getter(out, level, root)
    out.line()
  })

  level.forEachLevel(function(name) {
    gen_getter(out, level, name)
    out.line()
  })
}


function gen_getter(out, level, name) {
  out.line(`${level.name}.prototype._get_${name} = function()`)

  let type = level.def(name).type

  if (type == 'const') {
    out.block(() => {
      out.line(`return this.${name}`)
    })
    return
  }

  out.block(() => {
    out.line(`return this._val_${name} === undefined ? this._compute_${name}() : this._val_${name}`)
  })

  out.line()

  if (type == 'level') {
    gen_level_compute(out, level, name)
  } else {
    gen_fn_compute(out, level, name)
  }
}


function gen_level_compute(out, level, name) {
  let def = level.def(name)
  out.line(`${level.name}.prototype._compute_${name} = function()`)
  out.block(() => {
    out.line(`let _parent = this`)
    out.line(`return this._val_${name} = `)
    gen_level_function(out, def)
  })
}


function gen_level_function(out, level) {
  if (level.isClosable) {
    out.line(`function*(${level.seeds.join(', ')})`)
    out.block(() => {
      out.line(`let _i = new ${level.name}(${['_parent'].concat(level.seeds).join(', ')})`)
      out.line('try')
      out.block(() => {
        out.line(`return (yield _i._get_${level.main})`)
      })
      out.line('finally')
      out.block(() => {
        out.line('_i._close()')
      })
    })
  } else {
    out.line(`function(${level.seeds.join(', ')})`)
    out.block(() => {
      out.line(`return new ${level.name}(${['_parent'].concat(level.seeds).join(', ')})`)
    })
  }
}


function gen_fn_compute(out, level, name) {
  out.line(`${level.name}.prototype._compute_${name} = function*()`)
  out.block(() => {
    out.line(`let _future = this._val_${name} = new _go.Future`)
    out.line('try')
    out.block(() => {
      level.forEachDependencyOf(name, function(dep) {
        gen_local(out, level, dep)
      })
      out.line(`let _val = yield this.${name}(${level.def(name).args.join(', ')})`)
      out.line(`future.done(null, _val)`)
      out.line('return _val')
    })
    out.line('catch(_e)')
    out.block(() => {
      out.line('_future.done(_toError(_e))')
      out.line('throw _e')
    })
  })
}


function gen_local(out, level, name) {
  let rhs
  if (level.isSeed(name)) {
    rhs = `this.${name}`
  } else if (level.isRoot(name)) {
    rhs = `yield this._get_${name}()`
  } else if (!level.has(name)) {
    rhs = `yield this._parent._get_${name}()`
  } else if (level.def(name).type == 'const') {
    rhs = `this.${name}`
  } else if (level.def(name).type == 'level') {
    rhs = `this._get_${name}()`
  } else {
    rhs = `yield this.${name}(${level.def(name).args.join(', ')})`
  }
  out.line(`let ${name} = ${rhs}`)
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
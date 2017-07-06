const forOwn = require('lodash.forown')
const {Level, Fn, Const} = require('./objs')


module.exports = analyze


function walk(graph, adjacents, pre, post, root) {
  let visited = {}
  let seen = {}

  function visit(node) {
    if (visited[node]) return
    if (seen[node]) throw new Error(`Cycle detected involving ${node}`)
    if (pre && pre(node, graph[node]) === false) return
    seen[node] = true
    adjacents(node, graph[node], visit)
    visited[node] = true
    if (post) post(node, graph[node])
  }

  visit(root)
}


function dependencies(name, def, cb) {
  def.forEachDependency(cb)
}


function walk_level(defs, level, cb) {
  walk(
    defs,
    dependencies,
    function pre(name, def) {
      if (def == null && !level.isSeed(name)) throw new Error(`${name} is not defined`)
      if (level.isSeed(name) || def.type == 'level' || def.type == 'const') {
        cb(name)
        return false
      }
    },
    cb,
    level.main
  )
}


function walk_levels(defs, root, cb) {
  walk(
    defs,
    function adjacents(name, level, k) {
      if (level == null) throw new Error(`Level ${name} is not defined`)
      walk_level(defs, level, function(name) {
        if (defs[name] && defs[name].type == 'level') {
          k(name)
        }
      })
    },
    null,
    cb,
    root
  )
}


function analyze(definitions, main) {
  let defs = {}
  let levels = []

  forOwn(definitions, function(def, name) {
    if (def.seeds) {
      defs[name] = new Level(name, def)
    } else if (def.fn) {
      defs[name] = new Fn(name, def)
    } else {
      defs[name] = new Const(name, def.value)
    }
  })

  if (defs[main] == null) throw new Error(`${main} is not defined`)
  if (defs[main].type != 'level') throw new Error(`${main} is not a level`)

  walk_levels(defs, main, function(name, level) {
    analyze_level_definitions(defs, level, name == main)
    analyze_level_dependencies(level)
    analyze_level_roots(level)
    levels.push(level)
  })

  return {defs: defs, levels: levels, main: main}
}


function analyze_level_definitions(defs, level, is_main) {
  walk(
    defs,
    dependencies,
    function pre(name, def) { return def != null },
    function post(name, def) {
      let has_no_deps = true
      def.forEachDependency(function(dep) {
        has_no_deps = false
        if (level.has(dep) || level.isSeed(dep)) {
          level.defs[name] = def
        }
      })
      if (is_main && has_no_deps) {
        level.defs[name] = def
      }
    },
    level.main
  )
}


function analyze_level_dependencies(level) {
  walk(
    level.defs,
    dependencies,
    function pre(name, def) {
      if (def != null) return true
      if (!level.isSeed(name)) {
        level.requires[name] = true
      }
      return false
    },
    null,
    level.main
  )
}


function analyze_level_roots(level) {
  let usage = {}

  function use(what, from) {
    let u = usage[what] || (usage[what] = [])
    if (u.indexOf(from) < 0) u.push(from)
  }

  use(level.main, level.name)

  level.roots[level.main] = true

  walk(
    level.defs,
    dependencies,
    function pre(name, def) {
      if (def == null) return false
      if (def.type == 'level') level.roots[name] = true
      if (def.type == 'level' || usage[name].length > 1) {
        def.forEachDependency(dep => {
          use(dep, name)
          level.roots[dep] = true
        })
      } else {
        def.forEachDependency(dep => use(dep, usage[name][0]))
      }
    },
    null,
    level.main
  )

}


Level.prototype.forEachDependencyOf = function(task, cb) {
  walk(
    this.defs,
    dependencies,
    function pre(name, def) {
      if (def == null || def.type == 'level') {
        cb(name)
        return false
      }
    },
    function post(name) {
      if (name != task) cb(name)
    },
    task
  )
}

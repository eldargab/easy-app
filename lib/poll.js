var toError = require('go-async').toError
var notReady = new Error('NOT READY')


exports.throwNotReady = function(wait) {
  notReady.wait = wait
  throw notReady
}


exports.run = run


function run(future, fn) {
  try {
    future.done(null, fn())
  } catch(e) {
    if (e === notReady) {
      handleNotReady(future, fn)
    } else {
      future.done(toError(e))
    }
  }
}


function handleNotReady(future, fn) {
  var wait = notReady.wait
  notReady.wait = null
  wait.get(function() {
    run(future, fn)
  })
}
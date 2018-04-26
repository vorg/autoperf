const viz = require('./viz')
const fs = require('fs')

function compare (files) {
  var funcToHighlight = files.find((file) => file.indexOf('.json') === -1)
  var filesToLoad = files.filter((file) => file.indexOf('.json') !== -1)
  let s = ''
  filesToLoad.forEach((file, i) => {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    s += viz(file, json, funcToHighlight, i * 300,)
  })
  var html = `<html><body>${s}</body></html>`
  fs.writeFileSync('compare.html', html)
}

module.exports = compare

const loadJSON = require('pex-io/loadJSON')
const R = require('ramda')

const nodesById = {}
const traceFile = 'continuous-transition.json'

function printNodeTree (s, node, level) {
  s = s || ''
  level = level || 0
  console.log('node', node, s, level)
  s += '\n' + '&nbsp;'.repeat(level * 2) + (node.callFrame.functionName || '[unknown]') + ` / ${node.id}`
  node.children.forEach((child) => {
    s += printNodeTree('', child, level + 1)
  })
  return s
}

const knownEvents = ['Profile', 'ProfileChunk', 'ParseHTML', 'EvaluateScript']

function parseTraceFile (data) {
  let traceEvents = data.traceEvents
    .filter((e) => e.ts)
    .filter((e, i) => knownEvents.includes(e.name) || i == 0 || e.cat === 'disabled-by-default-v8.cpu_profiler')
  traceEvents.sort((a, b) => a.ts - b.ts)
  traceEvents = traceEvents.slice(0, 20)
  // const profilerEvents = data.traceEvents.filter(R.propEq('cat', 'disabled-by-default-v8.cpu_profiler'))
  // console.log('profilerEvents', profilerEvents, profilerEvents[1])
  console.log('traceEvents', traceEvents)
  var s = ''
  var prevTime = 0
  var startTime = 0
  var profileStartTime = 0
  let totalTime = 0
  const samples = []
  traceEvents.forEach((e, i) => {
    if (!prevTime) {
      prevTime = e.ts
    }
    if (!startTime) {
      startTime = e.ts
    }
    const deltaTimeMs = (e.ts - prevTime) / 1000
    const startTimeMs = (e.ts - startTime) / 1000
    prevTime = e.ts
    s += `\n${startTimeMs}ms ${e.name} #${i} : ${e.ts}\n\n`

    if (e.name === 'Profile') {
      profileStartTime = e.args.data.startTime
    }

    if (e.args && e.args.data && e.args.data.cpuProfile) {
      const cpuProfile = e.args.data.cpuProfile

      if (cpuProfile.nodes) {
        cpuProfile.nodes.forEach((node) => {
          if (!nodesById[node.id]) {
            node.children = []
            nodesById[node.id] = node
          }
          if (nodesById[node.parent]) {
            nodesById[node.parent].children.push(node)
          }
        })
      }
      let timestamps = []
      if (cpuProfile.samples) {
        cpuProfile.samples.forEach((sample, j) => {
          totalTime += e.args.data.timeDeltas[j]
          var node = nodesById[sample]

          if (!node) return
          samples.push({
            start: (totalTime + profileStartTime - startTime)/1000,
            name: node.callFrame.functionName || ['unknown'],
            node: node
          })
        })
      }
      s+= '<span style="color: #111">'
      s+= samples.map((s) => `${s.start} ${s.name} / ${s.node.id}`).join('\n')
      s+= '\n'
      //s+= timestamps.join(', ')
      s+= '</span>\n\n'
      s+= '<span style="color: #999">'
      s+= printNodeTree('', nodesById[1])
      s+= '</span>\n\n'
    }
  })
  return s
}

loadJSON(traceFile, (err, data) => {
  const s = parseTraceFile(data)
  var pre = document.createElement('div')
  pre.style.fontFamily = 'monospace'
  pre.innerHTML = s.replace(/\n/g, '<br/>')
  document.body.appendChild(pre)
})

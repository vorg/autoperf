const loadJSON = require('pex-io/loadJSON')
const R = require('ramda')

const nodesById = {}

function printNodeTree (s, node, level) {
  s = s || ''
  level = level || 0
  console.log('node', node, s, level)
  s += '\n' + '&nbsp;'.repeat(level * 2) + (node.callFrame.functionName || '[unknown]')
  node.children.forEach((child) => {
    s += printNodeTree('', child, level + 1)
  })
  return s
}

loadJSON('continuous-transition.json', (err, data) => {
  console.log('loaded', err, data)
  const cats = R.uniq(R.pluck('cat', data.traceEvents))
  console.log('cats', cats)
  const traceEvents = data.traceEvents.filter((e) => e.ts)
  traceEvents.sort((a, b) => a.ts - b.ts)
  const profilerEvents = data.traceEvents.filter(R.propEq('cat', 'disabled-by-default-v8.cpu_profiler'))
  console.log('profilerEvents', profilerEvents, profilerEvents[1])
  var pre = document.createElement('div')
  pre.style.fontFamily = 'monospace'
  var s = ''
  var prevTime = 0
  var startTime = 0
  var sampleIndex = 0
  var profileStartTime = 0
  let totalTime = 0
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
    let duration = 0
    if (i < traceEvents.length - 1) {
      duration = traceEvents[i + 1].ts - e.ts
    }
    var ok = true
    if (i < 1260) ok = false
    if (e.name == 'Profile') ok = true
    if (e.name == 'ProfileChunk') ok = true
    if (e.name == 'ParseHTML') ok = true
    if (e.name == 'EvaluateScript') ok = true
    if (e.cat == 'disabled-by-default-v8.cpu_profiler') ok = true
    if (i > 1400) ok = false
    if (i == 0) ok = true
    if (!ok) return
    //duration = 0
    s += `<b>${startTimeMs}ms : ${e.name} : ${duration}ms</b> #${i} : ${e.ts}\n\n`

    if (e.name == 'Profile') {
      profileStartTime = e.args.data.startTime
    }
    //top 4.3ms2
    //second 3.19ms
    //eachProp 0.62ms
    //setTimeout 0.64ms
    //setTimeout 69us

    if (e.args && e.args.data && e.args.data.cpuProfile && sampleIndex < 10) {
      const cpuProfile = e.args.data.cpuProfile
      const samples = []

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
        // https://github.com/ChromeDevTools/devtools-frontend/blob/fee00605cada877c1f8e3aae758a0f8d05b64476/front_end/sdk/CPUProfileDataModel.js#L94
        let lastTimeUsec = e.ts
        timestamps = new Array(e.args.data.timeDeltas.length + 1);
        for (let i = 0; i < e.args.data.timeDeltas.length; ++i) {
          timestamps[i] = lastTimeUsec;
          lastTimeUsec += e.args.data.timeDeltas[i];
        }
        timestamps[e.args.data.timeDeltas.length] = lastTimeUsec

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
  console.log(nodesById)
  pre.innerHTML = s.replace(/\n/g, '<br/>')
  document.body.appendChild(pre)
})

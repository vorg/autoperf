// const loadJSON = require('pex-io/loadJSON')
const R = require('ramda')
const h = require('@thi.ng/hiccup')
const colorScale = require('d3-scale-chromatic').interpolateViridis

function printNodeTree (s, node, level) {
  if (!node) return
  s = s || ''
  level = level || 0
  s += '\n' + '&nbsp;'.repeat(level * 2) + (node.callFrame.functionName || '[unknown]') + ` / ${node.id}`
  node.children.forEach((child) => {
    s += printNodeTree('', child, level + 1)
  })
  return s
}

const knownEvents = ['Profile', 'ProfileChunk', 'ParseHTML', 'EvaluateScript']

function parseTraceFile (data) {
  const nodesById = {}
  let traceEvents = data.traceEvents
    .filter((e) => e.ts)

  traceEvents.sort((a, b) => a.ts - b.ts)

  traceEvents = traceEvents
    .filter((e, i) => knownEvents.includes(e.name) || i == 0 || e.cat === 'disabled-by-default-v8.cpu_profiler')

  // traceEvents = traceEvents.slice(0, 20)
  // const profilerEvents = data.traceEvents.filter(R.propEq('cat', 'disabled-by-default-v8.cpu_profiler'))
  // console.log('profilerEvents', profilerEvents, profilerEvents[1])
  // console.log('traceEvents', traceEvents)
  var s = ''
  var prevTime = 0
  var startTime = 0
  var profileStartTime = 0
  let totalTime = 0
  const allSamples = []
  const callStack = []
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
      const chunkSamples = []
      if (cpuProfile.nodes) {
        cpuProfile.nodes.forEach((node) => {
          if (!nodesById[node.id]) {
            node.children = []
            if (!node.callFrame.functionName) {
              node.callFrame.functionName = 'unknown'
            }
            nodesById[node.id] = node
          }
          if (nodesById[node.parent]) {
            node.parentNode = nodesById[node.parent]
            node.parentNode.children.push(node)
          }
        })
      }
      if (cpuProfile.samples) {
        cpuProfile.samples.forEach((sample, j) => {
          totalTime += e.args.data.timeDeltas[j]
          var node = nodesById[sample]

          var sampleTime = (totalTime + profileStartTime - startTime)/1000
          //if (!node) return
          var sample = {
            start: sampleTime,
            totalTime: totalTime,
            profileStartTime: profileStartTime,
            startTime: startTime,
            name: node.callFrame.functionName,
            node: node
          }

          // find common partent with the next call
          var commonAncestor = undefined
          var potentialCommonAncestor = node
          while (potentialCommonAncestor && !commonAncestor) {
            //console.log(`  checking ${potentialCommonAncestor.callFrame.functionName}`)
            for (let i = callStack.length - 1; i >= 0; i--) {
              if (callStack[i] === potentialCommonAncestor) {
                commonAncestor = potentialCommonAncestor
                break
              }
            }
            potentialCommonAncestor = potentialCommonAncestor.parentNode
          }

          // pop parents until common ancestor
          if (commonAncestor) {
             while (callStack.length && (callStack[callStack.length - 1] !== commonAncestor)) {
               var nodeThatJunstFinished = callStack.pop()
               var nodeTime = sampleTime - nodeThatJunstFinished.start
               var name = nodeThatJunstFinished.callFrame.functionName
               // console.log(`${name} = ${nodeTime.toFixed(3)}ms`)
               allSamples.push({
                 name: name,
                 depth: callStack.length,
                 start: nodeThatJunstFinished.start,
                 duration: nodeTime
               })
             }
          }

          // push all your parents on stack
          var currNode = node
          var stackToPush = []
          while (currNode !== commonAncestor) {
            stackToPush.push(currNode)
            currNode.start = sampleTime
            currNode = currNode.parentNode
          }
          while (stackToPush.length) {
            callStack.push(stackToPush.pop())
          }
          var callStackStr = ''//var callStackStr = callStack.map((node) => node.callFrame.functionName).join(', ')
          // console.log('currNode', node.callFrame.functionName, '<-', commonAncestor ? commonAncestor.callFrame.functionName : '', `[${callStackStr}]`)
          chunkSamples.push(sample)
        })
      }
      s+= '<span style="color: #111">'
      s+= chunkSamples.map((s) => `${s.start} ${s.name} / ${s.node.id}`).join('\n')
      s+= '\n'
      //s+= timestamps.join(', ')
      s+= '</span>\n\n'
      s+= '<span style="color: #999">'
      s+= printNodeTree('', nodesById[1])
      s+= '</span>\n\n'
    }
  })
  return {
    str: s,
    samples: allSamples
  }
}

function viz (traceFile, data, searchFor, topOffset) {
  topOffset = topOffset || 0
  // loadJSON(traceFile, (err, data) => {
    const result = parseTraceFile(data)
    let s = '' //result.str

    var height = 10
    var wScale = 0.5
    var maxDepth = result.samples.reduce((maxDepth, sample) => Math.max(maxDepth, sample.depth), 0)
    var minStart = result.samples.reduce((minStart, sample) => Math.min(minStart, sample.start), Infinity)
    var avg = 0
    var avgCount = 0
    var bars = result.samples.map((sample) => {
      var bgcolor = colorScale(sample.depth / maxDepth)
      if (sample.name === searchFor) {
        bgcolor = 'red'
        avg += sample.duration
        avgCount++
      }
      return ['div', {
        style: {
          position: 'absolute',
          left: `${(sample.start - minStart) * wScale}px`,
          top: `${sample.depth * height + topOffset + 30}px`,
          width: `${Math.max(1, sample.duration * wScale)}px`,
          height: `${height}px`,
          //background: `rgb(${random.int(0, 255)}, ${random.int(0, 255)}, ${random.int(0, 255)})`
          //background: `rgb(${sample.depth * 10}, 0, 0)`
          background: bgcolor
        }
      }]
    })
    avg /= (avgCount || 1)
    s += h.serialize(['div',
      ['div', {
        style: {
          position: 'absolute',
          top: `${topOffset}px`,
          left: `5px`
        }
      }, traceFile + (searchFor ? (`\n${searchFor} avg ${avg.toFixed(3)}ms`) : '')],
      bars
    ])
    // var pre = document.createElement('div')
    // pre.style.fontFamily = 'monospace'
    // pre.innerHTML = s.replace(/\n/g, '<br/>')
    // document.body.appendChild(pre)
    return s
  // })
}

//graph('continuous-transition.json')
//graph('continuous-transition-1.json', 300)
//graph('continuous-transition-2.json', 600)

// graph('geom-builder-old.json')
// graph('geom-builder-new.json', 300)
//
module.exports = viz

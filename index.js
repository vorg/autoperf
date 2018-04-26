#! /usr/bin/env node
const puppeteer = require('puppeteer')
const program = require('commander')
const pkg = require('./package.json')
const compare = require('./compare')

program
  .version(pkg.version)
  //.command('autoperf <url>')
  .usage('<url> [options]')
  .command('trace', 'profile given url')
  .option('-t, --timeout <s>', 'Amount of time to wait after page load in seconds [1]', parseInt)
  .option('-o, --out <file>', 'Output trace file [trace.json]')
  .command('compare [funcToHighlight] <file1.json> <file2.json> ...', 'compare traces')
  .parse(process.argv)

const timeout = program.timeout || 1
const out = program.out || 'trace.json'
let url = program.args ? program.args[0] : null

if (!url) {
  program.outputHelp()
  process.exit(-1)
}

if (url === 'compare') {
  const files = program.args.slice(1)
  compare(files)
  console.log('Comparision viz saved to "compare.html"')
  process.exit(-1)
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--headless',
      // '--disable-gpu', // disable disable aka enable
      '--hide-scrollbars',
      '--mute-audio'
    ]
  })
  const page = await browser.newPage()
  await page.tracing.start({path: out })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitFor(timeout * 1000)
  await page.tracing.stop()

  await browser.close()
})()

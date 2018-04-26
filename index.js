#! /usr/bin/env node
const puppeteer = require('puppeteer')
const program = require('commander')
const pkg = require('./package.json')

program
  .version(pkg.version)
  //.command('autoperf <url>')
  .usage('<url> [options]')
  .option('-t, --timeout <s>', 'Amount of time to wait after page load in seconds [1]', parseInt)
  .option('-o, --out <file>', 'Output trace file [trace.json]')
  .parse(process.argv)

const timeout = program.timeout || 1
const out = program.out || 'trace.json'
const url = program.args[0]

if (!url) {
  program.outputHelp()
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
  await page.screenshot({path: 'continuous-transition.png'})

  await browser.close()
})()

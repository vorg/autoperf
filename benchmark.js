const puppeteer = require('puppeteer')

;(async () => {
  //const browser = await puppeteer.launch()
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--headless',
      '--hide-scrollbars',
      '--mute-audio'
    ]
  })
  const page = await browser.newPage()
  await page.tracing.start({path: 'continuous-transition.json'})
  await page.goto('http://marcinignac.com/experiments/continuous-transition/demo/', {"waitUntil" : "networkidle0"})
  await page.waitFor(1*1000)
  await page.tracing.stop()
  await page.screenshot({path: 'continuous-transition.png'})

  await browser.close()
})()

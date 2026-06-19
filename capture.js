import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  const consoleMessages = []
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
  })
  
  page.on('pageerror', (err) => {
    consoleMessages.push(`[ERROR] ${err.message}`)
  })
  
  page.on('requestfailed', (request) => {
    consoleMessages.push(`[REQ_FAIL] ${request.url()}: ${request.failure()?.errorText}`)
  })

  page.on('response', (response) => {
    if (response.status() >= 400) {
      consoleMessages.push(`[RESP_ERR] ${response.url()}: status ${response.status()}`)
    }
  })
  
  console.log('Navigating to reader page...')
  try {
    await page.goto('http://localhost:5173/', { timeout: 5000 })
    await page.waitForTimeout(2000)
  } catch (e) {
    console.error('Navigation failed:', e.message)
  }
  
  console.log('Console logs:', consoleMessages)
  
  // Take screenshot
  const screenshotPath = '/Users/nemo/.gemini/antigravity/brain/0e0fe825-4142-4dc2-9c92-64b317937e1e/reader_screenshot.png'
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log('Screenshot saved to:', screenshotPath)
  
  // Check HTML body
  const bodyHtml = await page.evaluate(() => document.body.innerHTML)
  console.log('Body HTML length:', bodyHtml.length)
  
  fs.writeFileSync('/Users/nemo/.gemini/antigravity/brain/0e0fe825-4142-4dc2-9c92-64b317937e1e/body.html', bodyHtml)
  console.log('Saved body.html')
  
  await browser.close()
}

run().catch(console.error)

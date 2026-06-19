import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const profileDir = path.join(__dirname, 'chrome-profile')
const dataDir = path.join(__dirname, 'data')
const accountsPath = path.join(__dirname, 'accounts.json')
const outputPath = path.join(dataDir, 'latest.json')
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const command = process.argv[2] || 'fetch'
const headless = process.env.X_HEADLESS !== 'false'

async function launch() {
  return chromium.launchPersistentContext(profileDir, {
    executablePath: chromePath,
    headless: command === 'login' ? false : headless,
    viewport: { width: 1280, height: 980 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })
}

async function login() {
  const context = await launch()
  const page = await context.newPage()
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
  console.log('Login window opened. Log in to X, then come back here and run: npm run x:check')
}

function normalizeTweetText(text) {
  return text
    .replace(/\n+/g, '\n')
    .replace(/^\s+|\s+$/g, '')
}

async function extractTweets(page, handle) {
  await page.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(5000)

  const loginText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '')
  if (/Sign in|Log in|登录|登入|注册/.test(loginText) && !loginText.includes('@')) {
    return { handle, status: 'needs_login', tweets: [] }
  }

  for (let i = 0; i < 3; i += 1) {
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(1500)
  }

  const tweets = await page.evaluate((targetHandle) => {
    const articles = Array.from(document.querySelectorAll('article'))
    return articles.map((article) => {
      const text = article.innerText || ''
      const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]'))
        .map((a) => a.getAttribute('href'))
        .find(Boolean)
      const time = article.querySelector('time')?.getAttribute('datetime') || ''
      const href = statusLink ? new URL(statusLink, location.origin).toString() : ''
      const id = href.match(/status\/(\d+)/)?.[1] || ''
      return { id, href, time, text }
    })
      .filter((tweet) => tweet.id && tweet.href.includes(`/${targetHandle}/status/`))
  }, handle)

  const seen = new Set()
  const cleanTweets = tweets
    .filter((tweet) => !/已置顶|Pinned/.test(tweet.text))
    .filter((tweet) => !/已转帖|reposted/i.test(tweet.text.split('\n').slice(0, 3).join(' ')))
    .filter((tweet) => {
      if (seen.has(tweet.id)) return false
      seen.add(tweet.id)
      return true
    })
    .slice(0, 8)
    .map((tweet) => ({
      ...tweet,
      text: normalizeTweetText(tweet.text),
      captured_at: new Date().toISOString(),
    }))

  return { handle, status: cleanTweets.length > 0 ? 'ok' : 'no_tweets_found', tweets: cleanTweets }
}

async function check() {
  const context = await launch()
  const page = await context.newPage()
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(5000)
  const body = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '')
  const loggedIn = /Home|主页|For you|Following|关注|Post|发帖/.test(body) && !/Sign in to X|Log in to X/.test(body)
  console.log(JSON.stringify({ loggedIn, checked_at: new Date().toISOString() }, null, 2))
  await context.close()
}

async function fetchAll() {
  await fs.mkdir(dataDir, { recursive: true })
  const accounts = JSON.parse(await fs.readFile(accountsPath, 'utf8'))
  const context = await launch()
  const page = await context.newPage()
  const results = []

  for (const account of accounts) {
    try {
      const result = await extractTweets(page, account.handle)
      results.push({ ...account, ...result })
      console.log(`${account.handle}: ${result.status} (${result.tweets.length})`)
    } catch (error) {
      results.push({ ...account, status: 'error', error: String(error), tweets: [] })
      console.log(`${account.handle}: error`)
    }
  }

  const payload = {
    captured_at: new Date().toISOString(),
    source: 'x.com via persistent local Chrome profile',
    results,
  }
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
  await context.close()
  console.log(outputPath)
}

if (command === 'login') {
  await login()
} else if (command === 'check') {
  await check()
} else if (command === 'fetch') {
  await fetchAll()
} else {
  console.error('Usage: node tools/x-monitor/x-monitor.mjs [login|check|fetch]')
  process.exit(1)
}

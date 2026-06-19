import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

loadEnv(path.join(rootDir, '.env'))

const PORT = Number(process.env.GEO_RADAR_PORT || 5198)
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const MAX_BODY_BYTES = 1024 * 1024

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(JSON.stringify(payload, null, 2))
}

function normalizeUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '')
  return `https://${raw.replace(/\/+$/, '')}`
}

function assertPublicUrl(url) {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('只支持 http/https URL')
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === '169.254.169.254'
  ) {
    throw new Error('为避免误抓本机/内网地址，网站 URL 必须是公网地址')
  }
}

async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('请求内容过大')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 GEO-Radar/1.0 (+local audit; AI visibility)',
        accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8',
      },
    })
    const text = await response.text()
    return { ok: response.ok, status: response.status, url: response.url, text: text.slice(0, 800000) }
  } finally {
    clearTimeout(timer)
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMeta(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || ''
  const metas = {}
  for (const match of html.matchAll(/<meta\s+([^>]+)>/gi)) {
    const attrs = match[1]
    const name = attrs.match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1]?.toLowerCase()
    const content = attrs.match(/\bcontent=["']([^"']*)["']/i)?.[1] || ''
    if (name) metas[name] = content
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || ''
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1] || ''
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim())
  const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .slice(0, 200)
    .map((m) => ({ href: m[1], text: stripHtml(m[2]).slice(0, 120) }))
  return { title, h1, canonical, metas, jsonLd, links }
}

function scoreWebsite({ url, html, robots, llms, sitemap }) {
  const meta = extractMeta(html)
  const text = stripHtml(html)
  const lowerRobots = String(robots || '').toLowerCase()
  const scores = []
  const issues = []
  const wins = []

  const citationBots = ['oai-searchbot', 'perplexitybot', 'claudebot', 'google-extended']
  const blockedBots = citationBots.filter((bot) => {
    const botBlock = new RegExp(`user-agent:\\s*${bot}[\\s\\S]{0,300}?disallow:\\s*/`, 'i')
    return botBlock.test(robots)
  })
  let robotsScore = 10
  if (robots) {
    robotsScore += 8
    if (!blockedBots.length) robotsScore += 12
    if (/sitemap:/i.test(robots)) robotsScore += 5
  }
  if (blockedBots.length) issues.push(`robots.txt 可能阻止 AI citation bot：${blockedBots.join(', ')}`)
  else wins.push('未发现关键 AI citation bot 被 robots.txt 明确阻止')
  scores.push({ name: 'AI 爬虫访问', score: Math.min(35, robotsScore), max: 35 })

  let llmsScore = llms ? 12 : 0
  if (llms && /^#\s+/m.test(llms)) llmsScore += 3
  if (llms && />\s+/.test(llms)) llmsScore += 2
  if (llms && /\[[^\]]+\]\([^)]+\)/.test(llms)) llmsScore += 6
  if (!llms) issues.push('缺少 /llms.txt，AI 入口说明和重要页面清单不明确')
  else wins.push('/llms.txt 存在，可继续补充核心页面和标准答案')
  scores.push({ name: 'llms.txt', score: Math.min(23, llmsScore), max: 23 })

  let schemaScore = meta.jsonLd.length ? 8 : 0
  const schemaText = meta.jsonLd.join('\n').toLowerCase()
  if (/organization|localbusiness|website/.test(schemaText)) schemaScore += 6
  if (/article|faqpage|howto|product|softwareapplication/.test(schemaText)) schemaScore += 8
  if (/sameas/.test(schemaText)) schemaScore += 3
  if (!meta.jsonLd.length) issues.push('缺少 JSON-LD Schema，AI 难以确认实体、产品、文章和 FAQ 类型')
  else wins.push('检测到 JSON-LD Schema，可继续增强 FAQ/HowTo/Product/Article')
  scores.push({ name: '结构化数据', score: Math.min(25, schemaScore), max: 25 })

  let metaScore = 0
  if (meta.title) metaScore += 4
  if (meta.metas.description) metaScore += 4
  if (meta.canonical) metaScore += 2
  if (meta.metas['og:title'] && meta.metas['og:description']) metaScore += 3
  if (meta.h1) metaScore += 2
  if (!meta.metas.description) issues.push('缺少 meta description，AI 和搜索入口缺少页面摘要')
  scores.push({ name: 'Meta 与页面结构', score: Math.min(15, metaScore), max: 15 })

  let contentScore = 0
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const hasFaq = /常见问题|faq|frequently asked|q&a|问答/i.test(text)
  const hasStats = /(\d+(\.\d+)?%|\$\d+|\d+\s*(users|customers|客户|用户|案例|次|万|亿))/i.test(text)
  const hasComparison = /vs\.?|versus|替代|对比|compare|alternative/i.test(text)
  if (wordCount > 300) contentScore += 5
  if (hasFaq) contentScore += 4
  if (hasStats) contentScore += 4
  if (hasComparison) contentScore += 3
  if (/(how to|如何|步骤|指南|教程)/i.test(text)) contentScore += 3
  if (wordCount < 220) issues.push('首页可引用正文偏少，建议增加直接答案段、FAQ、案例和数据')
  if (!hasFaq) issues.push('缺少 FAQ/Q&A 结构，AI 不容易抽取标准答案')
  scores.push({ name: '内容可引用性', score: Math.min(19, contentScore), max: 19 })

  const total = scores.reduce((sum, item) => sum + item.score, 0)
  const max = scores.reduce((sum, item) => sum + item.max, 0)
  return {
    url,
    score: Math.round((total / max) * 100),
    scores,
    issues,
    wins,
    meta: {
      title: meta.title,
      description: meta.metas.description || '',
      h1: meta.h1,
      canonical: meta.canonical,
      schema_count: meta.jsonLd.length,
      sitemap_found: Boolean(sitemap),
      llms_found: Boolean(llms),
      word_count: wordCount,
    },
    page_text_sample: text.slice(0, 5000),
  }
}

function extractUrls(text) {
  const urls = new Set()
  for (const match of String(text || '').matchAll(/https?:\/\/[^\s)\]"'<>]+/g)) {
    urls.add(match[0].replace(/[.,，。;；]+$/, ''))
  }
  return [...urls]
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function countMentions(text, names) {
  const source = String(text || '').toLowerCase()
  return names.filter(Boolean).map((name) => {
    const normalized = String(name).trim()
    if (!normalized) return null
    const pattern = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase()
    const count = (source.match(new RegExp(pattern, 'g')) || []).length
    return { name: normalized, count }
  }).filter(Boolean)
}

function fallbackAnalysis(input, websiteAudit) {
  const aiAnswers = String(input.aiAnswers || '')
  const competitors = Array.isArray(input.competitors) ? input.competitors : splitLines(input.competitors)
  const urls = extractUrls(aiAnswers)
  const hosts = [...new Set(urls.map(hostOf).filter(Boolean))]
  const mentions = countMentions(aiAnswers, [input.brand, ...competitors])
  const competitorMentions = mentions.filter((item) => item.name !== input.brand)
  const brand = mentions.find((item) => item.name === input.brand) || { name: input.brand, count: 0 }
  const thirdParty = hosts.filter((host) => {
    const websiteHost = input.website ? hostOf(normalizeUrl(input.website)) : ''
    return host && host !== websiteHost
  })
  return {
    summary: `${input.brand || '目标品牌'}在当前材料中出现 ${brand.count} 次，竞品合计出现 ${competitorMentions.reduce((sum, item) => sum + item.count, 0)} 次。当前可抽取 ${thirdParty.length} 个第三方引用源。`,
    brand_visibility: {
      brand: input.brand || '',
      mention_count: brand.count,
      visibility_level: brand.count > 2 ? '中高' : brand.count > 0 ? '低' : '未出现',
      description_accuracy: '需要人工核查 AI 回答中的品牌描述',
    },
    competitor_mentions: competitorMentions.sort((a, b) => b.count - a.count),
    citation_sources: thirdParty.map((domain) => ({
      domain,
      urls: urls.filter((url) => hostOf(url) === domain).slice(0, 5),
      type: classifyDomain(domain),
      action: '检查该页面是否推荐竞品；如果可提交/评论/外联，优先争取品牌露出。',
    })),
    offsite_placements: thirdParty.slice(0, 8).map((domain) => ({
      target: domain,
      why: '已经出现在 AI/搜索材料中，可能是答案引擎会参考的站外页面。',
      action: '提交产品、补充评论、联系作者更新榜单，或写替代/对比内容抢同类查询。',
      priority: '中',
    })),
    content_actions: [
      { action: '新增 FAQ 页面', why: '把用户高频问题写成可直接引用的 Q&A。', priority: '高' },
      { action: '新增竞品对比页', why: '围绕核心关键词解释与竞品的差异和适用场景。', priority: '高' },
      { action: '新增 llms.txt', why: '让 AI crawler 快速理解品牌、产品和关键页面。', priority: websiteAudit?.meta?.llms_found ? '低' : '高' },
      { action: '补强 JSON-LD Schema', why: '用 Organization、WebSite、FAQPage、SoftwareApplication 明确实体。', priority: websiteAudit?.meta?.schema_count ? '中' : '高' },
    ],
    article_ideas: [
      `《${input.brand || '这个品牌'}如何成为 AI 回答里的标准答案》`,
      `《为什么 AI 推荐了竞品，却没有推荐你？》`,
      `《GEO 不是多写文章，而是占住 AI 引用源》`,
    ],
    xhs_cards: [
      'AI 不推荐你的 5 个原因',
      'GEO 引用源占位清单',
      '官网内容改造成 AI 标准答案的 7 步',
    ],
    seven_day_plan: [
      '第 1 天：确定 20 个用户真实问题和 5 个竞品。',
      '第 2 天：收集 ChatGPT/Perplexity/豆包/千问回答并导入。',
      '第 3 天：处理第三方引用源，优先提交目录站和榜单。',
      '第 4 天：改造官网 FAQ、HowTo、对比页。',
      '第 5 天：补 robots.txt、llms.txt、schema。',
      '第 6 天：发布 1 篇公众号 + 1 组小红书卡片 + 1 条 X 长帖。',
      '第 7 天：复测品牌提及率、竞品次数和引用源变化。',
    ],
  }
}

function classifyDomain(domain) {
  if (/reddit|quora|zhihu|v2ex|news.ycombinator/.test(domain)) return '社区'
  if (/producthunt|g2|capterra|alternativeto|saas|tools|directory|aitools/.test(domain)) return '目录/榜单'
  if (/youtube|bilibili|tiktok|xiaohongshu|x\.com|twitter/.test(domain)) return '社媒/视频'
  if (/blog|medium|substack|wordpress/.test(domain)) return '博客/测评'
  return '网页'
}

function splitLines(value) {
  if (Array.isArray(value)) return value
  return String(value || '').split(/[\n,，]/).map((item) => item.trim()).filter(Boolean)
}

async function callDeepSeek(input, websiteAudit, localSignals) {
  if (!DEEPSEEK_API_KEY) throw new Error('缺少 DEEPSEEK_API_KEY')
  const prompt = [
    '你是一个GEO/AI搜索优化产品经理。基于用户输入、网站体检和AI回答材料，输出严格JSON，不要Markdown。',
    '目标：输入品牌/竞品/关键词，输出AI引用源、竞品出现次数、站外占位清单和内容改造动作。',
    '请避免空泛建议，每条动作都要可执行。',
    '',
    'JSON schema:',
    JSON.stringify({
      summary: '一句话结论',
      brand_visibility: { brand: '品牌', mention_count: 0, visibility_level: '未出现/低/中/高', description_accuracy: '描述是否准确' },
      competitor_mentions: [{ name: '竞品', count: 0, note: '出现语境' }],
      citation_sources: [{ domain: '域名', urls: ['url'], type: '社区/目录/榜单/媒体/官网/其他', action: '怎么占位' }],
      offsite_placements: [{ target: '站外页面或平台', why: '为什么值得做', action: '具体动作', priority: '高/中/低' }],
      content_actions: [{ action: '内容改造动作', why: '原因', priority: '高/中/低' }],
      article_ideas: ['公众号/长文标题'],
      xhs_cards: ['小红书图片笔记标题'],
      seven_day_plan: ['7天执行动作'],
    }),
    '',
    '用户输入:',
    JSON.stringify(input, null, 2).slice(0, 12000),
    '',
    '网站GEO体检:',
    JSON.stringify(websiteAudit, null, 2).slice(0, 12000),
    '',
    '本地候选信号:',
    JSON.stringify(localSignals, null, 2).slice(0, 8000),
  ].join('\n')

  const response = await fetch(`${DEEPSEEK_BASE_URL.replace(/\/+$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你只输出可解析JSON。' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`DeepSeek API ${response.status}: ${detail.slice(0, 300)}`)
  }
  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

function loadLocalSignals(keywords) {
  const files = [
    path.join(rootDir, 'tools/report-builder/data/candidates.json'),
    path.join(rootDir, 'tools/opportunity-monitor/data/latest.json'),
    path.join(rootDir, 'tools/x-monitor/data/latest.json'),
  ]
  const needle = splitLines(keywords).join(' ').toLowerCase()
  const terms = needle.split(/\s+/).filter((item) => item.length > 2).slice(0, 20)
  const results = []
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'))
      const items = [
        ...(json.editorial_candidates || []),
        ...(json.candidates || []),
        ...(json.items || []),
        ...(json.posts || []),
        ...(Array.isArray(json) ? json : []),
      ]
      for (const item of items) {
        const text = `${item.title || ''} ${item.summary || ''} ${item.text || ''} ${item.original_text || ''}`.toLowerCase()
        if (!terms.length || terms.some((term) => text.includes(term))) {
          results.push({
            source: item.source || item.source_type || item.account || 'local',
            title: item.title || item.text?.slice(0, 80) || '',
            url: item.url || '',
            summary: item.summary || item.original_text || item.text || '',
            tags: item.tags || [],
            score: item.score || 0,
          })
        }
      }
    } catch {
      // Ignore malformed local cache.
    }
  }
  return results.slice(0, 20)
}

async function auditWebsite(website) {
  const url = normalizeUrl(website)
  if (!url) return null
  assertPublicUrl(url)
  const homepage = await fetchText(url)
  const base = new URL(homepage.url || url)
  const robots = await fetchText(`${base.origin}/robots.txt`).catch(() => ({ text: '' }))
  const llms = await fetchText(`${base.origin}/llms.txt`).catch(() => ({ text: '' }))
  const sitemapUrl = robots.text.match(/sitemap:\s*(\S+)/i)?.[1] || `${base.origin}/sitemap.xml`
  const sitemap = await fetchText(sitemapUrl).catch(() => ({ text: '' }))
  return scoreWebsite({
    url: homepage.url || url,
    html: homepage.text,
    robots: robots.text,
    llms: llms.ok ? llms.text : '',
    sitemap: sitemap.ok ? sitemap.text : '',
  })
}

function toMarkdown(input, websiteAudit, analysis) {
  const lines = [
    `# GEO 引用源雷达：${input.brand || '未命名品牌'}`,
    '',
    `官网：${input.website || '未填写'}`,
    `关键词：${splitLines(input.keywords).join('、') || '未填写'}`,
    `竞品：${splitLines(input.competitors).join('、') || '未填写'}`,
    '',
    '## 核心结论',
    analysis.summary || '',
    '',
    '## 品牌可见性',
    `- 品牌出现次数：${analysis.brand_visibility?.mention_count ?? 0}`,
    `- 可见度：${analysis.brand_visibility?.visibility_level || '未知'}`,
    `- 描述准确性：${analysis.brand_visibility?.description_accuracy || '待核查'}`,
    '',
    '## 竞品出现次数',
    ...(analysis.competitor_mentions || []).map((item) => `- ${item.name}: ${item.count} 次${item.note ? `｜${item.note}` : ''}`),
    '',
    '## 引用源',
    ...(analysis.citation_sources || []).map((item) => `- ${item.domain}｜${item.type || '网页'}｜${item.action || ''}\n  ${Array.isArray(item.urls) ? item.urls.join('\n  ') : ''}`),
    '',
    '## 站外占位清单',
    ...(analysis.offsite_placements || []).map((item) => `- [${item.priority || '中'}] ${item.target}：${item.action}（${item.why || ''}）`),
    '',
    '## 内容改造动作',
    ...(analysis.content_actions || []).map((item) => `- [${item.priority || '中'}] ${item.action}：${item.why || ''}`),
    '',
    '## 可写文章',
    ...(analysis.article_ideas || []).map((item) => `- ${item}`),
    '',
    '## 小红书图片笔记',
    ...(analysis.xhs_cards || []).map((item) => `- ${item}`),
    '',
    '## 7 天执行清单',
    ...(analysis.seven_day_plan || []).map((item) => `- ${item}`),
    '',
    '## 网站 GEO 体检',
    websiteAudit ? `总分：${websiteAudit.score}/100` : '未填写官网，未执行网站体检。',
    ...(websiteAudit?.scores || []).map((item) => `- ${item.name}: ${item.score}/${item.max}`),
    '',
    '### 网站问题',
    ...(websiteAudit?.issues || []).map((item) => `- ${item}`),
    '',
  ]
  return lines.join('\n')
}

async function runAudit(input) {
  const normalized = {
    brand: String(input.brand || '').trim(),
    website: String(input.website || '').trim(),
    competitors: splitLines(input.competitors),
    keywords: splitLines(input.keywords),
    aiAnswers: String(input.aiAnswers || '').trim(),
    market: String(input.market || '').trim(),
  }
  const websiteAudit = normalized.website ? await auditWebsite(normalized.website).catch((error) => ({ error: error.message })) : null
  const localSignals = loadLocalSignals(normalized.keywords)
  let analysis
  let ai_status = 'DeepSeek'
  try {
    analysis = await callDeepSeek(normalized, websiteAudit, localSignals)
  } catch (error) {
    ai_status = `本地兜底：${error.message}`
    analysis = fallbackAnalysis(normalized, websiteAudit)
  }
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    ai_status,
    input: normalized,
    website_audit: websiteAudit,
    local_signals: localSignals.slice(0, 8),
    analysis,
    markdown: toMarkdown(normalized, websiteAudit, analysis),
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (req.method === 'GET' && url.pathname === '/api/geo/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'geo-radar',
        deepseek_configured: Boolean(DEEPSEEK_API_KEY),
        model: DEEPSEEK_MODEL,
      })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/geo/audit') {
      const input = await readBody(req)
      const report = await runAudit(input)
      sendJson(res, 200, report)
      return
    }
    sendJson(res, 404, { ok: false, error: 'Not found' })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || String(error) })
  }
})

server.listen(PORT, () => {
  console.log(`GEO Radar API listening on http://127.0.0.1:${PORT}`)
})

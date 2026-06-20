import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const outputDir = path.join(__dirname, 'data')
const publicReportPath = path.join(projectRoot, 'public/report-candidates.json')
const statePath = path.join(outputDir, 'seen.json')
const candidatesPath = path.join(outputDir, 'candidates.json')
const markdownPath = path.join(outputDir, 'brief.md')
const actionsPath = path.join(outputDir, 'content-actions.json')
const xPath = path.join(projectRoot, 'tools/x-monitor/data/latest.json')
const opportunityPath = path.join(projectRoot, 'tools/opportunity-monitor/data/latest.json')
const wechatRssUrl = 'http://localhost:5010/api/rss/all'

const mode = process.argv.includes('--commit') ? 'commit' : 'preview'

const sourceWeights = {
  wechat: 4,
  x: 2,
  product_hunt: 3,
  reddit: 4,
  one_ms_yc: 4,
  one_ms_hn: 2,
  news: 4,
  podcast: 3,
  youtube: 3,
}

const tierWeights = {
  S: 3,
  A: 2,
  B: 1,
}

const positiveSignals = [
  ['openai codex', 10],
  ['chatgpt codex', 10],
  ['codex cli', 10],
  ['codex', 8],
  ['coding agent', 8],
  ['ai coding', 7],
  ['vibe coding', 6],
  ['claude code', 6],
  ['claude ai', 5],
  ['anthropic', 5],
  ['claude desktop', 5],
  ['claude artifacts', 5],
  ['cursor', 5],
  ['devin', 4],
  ['windsurf', 4],
  ['lovable', 4],
  ['bolt.new', 4],
  ['replit agent', 4],
  ['obsidian', 6],
  ['pkm', 4],
  ['knowledge base', 4],
  ['second brain', 4],
  ['creator revenue', 7],
  ['x payout', 7],
  ['twitter payout', 7],
  ['substack revenue', 6],
  ['youtube revenue', 6],
  ['newsletter revenue', 6],
  ['payout', 5],
  ['paid me', 5],
  ['made $', 6],
  ['mrr', 5],
  ['arr', 5],
  ['income report', 6],
  ['earnings', 5],
  ['赚钱', 6],
  ['收入', 6],
  ['收益', 6],
  ['月入', 6],
  ['上个月赚', 7],
  ['创作者收益', 7],
  ['viral', 5],
  ['views', 4],
  ['likes', 4],
  ['bookmarks', 4],
  ['retweets', 4],
  ['shares', 4],
  ['百万', 5],
  ['几十万', 4],
  ['阅读', 4],
  ['转发', 4],
  ['收藏', 4],
  ['点赞', 4],
  ['agent', 3],
  ['agents', 3],
  ['ai ', 2],
  [' ai', 2],
  ['workflow', 3],
  ['mcp', 3],
  ['tool', 2],
  ['tools', 2],
  ['saas', 2],
  ['micro saas', 3],
  ['microsaas', 3],
  ['seo', 2],
  ['geo', 6],
  ['generative engine optimization', 6],
  ['ai search', 5],
  ['chatgpt search', 5],
  ['perplexity', 4],
  ['answer engine', 5],
  ['aeo', 4],
  ['llmo', 4],
  ['llm visibility', 5],
  ['ai visibility', 5],
  ['ai 爬虫', 4],
  ['ai 搜索', 5],
  ['生成式引擎优化', 6],
  ['答案引擎', 5],
  ['visibility', 2],
  ['traffic', 2],
  ['mrr', 3],
  ['revenue', 3],
  ['launch', 2],
  ['product hunt', 2],
  ['cursor', 2],
  ['claude', 2],
  ['chatgpt', 2],
  ['notebooklm', 2],
  ['chrome extension', 2],
  ['automation', 2],
  ['template', 2],
  ['templates', 2],
  ['出海', 3],
  ['工具', 2],
  ['独立站', 3],
  ['流量', 2],
  ['变现', 2],
  ['案例', 2],
  ['token', 1],
]

const negativeSignals = [
  '招聘',
  'looking for technical partners',
  'commission',
  '求推荐',
  'recommendations',
  'recommend ',
  'you recommend',
  'what beginner mistake',
  'beginner mistake',
  'newsletter you recommend',
  'looking for feedback',
  'feedback on my',
  '信仰',
  '砸盘',
  '挂单',
  '徽章',
  'airdrop',
  '抽奖',
]

function normalizeWhitespace(text = '') {
  return text.replace(/\s+/g, ' ').trim()
}

function decodeEntities(text = '') {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function htmlToText(html = '') {
  return decodeEntities(html)
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return match ? decodeEntities(match[1].replace(/^<!\\[CDATA\\[|\\]\\]>$/g, '').trim()) : ''
}

function getEncodedContent(itemXml) {
  const match = itemXml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)
  return match ? match[1] : getTag(itemXml, 'description')
}

function toIso(dateText) {
  if (!dateText) return ''
  const date = new Date(dateText)
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString()
}

function itemKey(item) {
  return `${item.source_type}:${item.url || item.id || item.title}`
}

function signalScore(text) {
  const normalized = ` ${text.toLowerCase()} `
  let score = 0
  const matched = []
  for (const [keyword, weight] of positiveSignals) {
    if (normalized.includes(keyword)) {
      score += weight
      matched.push(keyword.trim())
    }
  }
  for (const keyword of negativeSignals) {
    if (normalized.includes(keyword.toLowerCase())) score -= 4
  }
  return { score, matched: [...new Set(matched)] }
}

function classify(item, matchedSignals) {
  const text = `${item.title} ${item.summary}`.toLowerCase()
  const tags = []
  const moneyCase = /creator revenue|x payout|twitter payout|substack revenue|youtube revenue|newsletter revenue|payout|paid me|made \$|income report|earnings|\bmrr\b|\barr\b|赚钱|收入|收益|月入|上个月赚|创作者收益/.test(text)
  const cryptoRightsNoise = /币东|发币|区块链|defi|crypto|btc/.test(text)
    && !/creator|payout|substack|youtube|newsletter|\bmrr\b|\barr\b|revenue|income report|made \$|月入|上个月赚|创作者收益|广告商|知识付费|网站|工具/.test(text)
  if (/codex|openai codex|chatgpt codex|codex cli|coding agent|ai coding|vibe coding|claude code|cursor|devin|windsurf|lovable|bolt\.new|replit agent/.test(text)) tags.push('Codex/AI编程')
  if (/claude|anthropic|claude code|claude desktop|claude artifacts/.test(text)) tags.push('Claude')
  if (/obsidian|pkm|knowledge base|second brain|zettelkasten/.test(text)) tags.push('Obsidian/知识库')
  if (moneyCase && !cryptoRightsNoise) tags.push('赚钱案例')
  if (item.source_type === 'podcast') tags.push('播客')
  if (item.source_type === 'youtube') tags.push('YouTube')
  if (item.source_type === 'news') tags.push('新闻')
  if (/viral|views|likes|bookmarks|retweets|shares|impressions|comments|百万|几十万|阅读|点赞|收藏|转发|评论/.test(text)) tags.push('自媒体素材')
  if (/geo|generative engine optimization|ai search|chatgpt search|perplexity|answer engine|aeo|llmo|llm visibility|ai visibility|ai 爬虫|ai 搜索|生成式引擎优化|答案引擎/.test(text)) tags.push('GEO')
  if (/agent|workflow|mcp|automation|tool|工具/.test(text)) tags.push('可做工具')
  if (/site|website|seo|geo|traffic|visibility|独立站|流量/.test(text)) tags.push('可做站')
  if (/case|mrr|revenue|8k|3k|案例|变现/.test(text)) tags.push('商业化案例')
  if (/prompt|说话|表达|content|newsletter|小红书|公众号/.test(text)) tags.push('可写内容')
  if (/token|btc|币安|mstr|徽章|crypto/.test(text)) tags.push('只观察')
  if (!tags.length && matchedSignals.length) tags.push('只观察')
  return [...new Set(tags)]
}

function hasConcreteProof(item) {
  const text = `${item.title} ${item.summary || ''}`.toLowerCase()
  return /(\$|mrr|revenue|arr|impressions|clicks|traffic|upvotes|comments|收入|访问|评论|点击|展示|月入|年收入|\d+(\.\d+)?\s*(k|m|万|千)?\s*(registered users|daily active users|monthly active users|users|customers|impressions|clicks|traffic|visits|revenue|\bmrr\b|\barr\b|comments|upvotes|用户|访问|评论|点击|展示|收入))/.test(text)
}

function hasDiscussionSignal(item) {
  return Number(item.comments || 0) > 0
    || Number(item.upvotes || item.score_external || 0) >= 10
}

function isColdCommunityPost(item) {
  if (!['reddit', 'product_hunt'].includes(item.source_type)) return false
  const recencyHours = item.published_at ? (Date.now() - new Date(item.published_at).valueOf()) / 36e5 : 999
  if (item.source_type === 'product_hunt') {
    return recencyHours <= 24 && !hasDiscussionSignal(item) && !hasConcreteProof(item)
  }
  return recencyHours <= 6 && !hasConcreteProof(item) && !hasDiscussionSignal(item)
}

function scoreItem(item) {
  const combined = `${item.title} ${item.summary || ''}`
  const signal = signalScore(combined)
  const recencyHours = item.published_at ? (Date.now() - new Date(item.published_at).valueOf()) / 36e5 : 999
  const recencyScore = recencyHours <= 12 ? 4 : recencyHours <= 36 ? 2 : recencyHours <= 96 ? 1 : -2
  const sourceScore = sourceWeights[item.source_type] || 0
  const tierScore = tierWeights[item.tier] || 0
  const evidenceScore = item.url ? 2 : 0
  const lower = combined.toLowerCase()
  const actionScore = /mrr|revenue|waiting|built|launch|template|workflow|agent|mcp|seo|visibility|8k|\$|case study|customers|用户|访问|收入/.test(lower) ? 3 : 0
  const proofScore = /mrr|revenue|\$\d|k\/mo|users|customers|traffic|访问|收入|用户|月/.test(lower) ? 4 : 0
  const questionPenalty = /^(any good|what beginner|looking for|how do i|should i|is there)/i.test(item.title) ? -5 : 0
  const coldCommunityPenalty = isColdCommunityPost(item) ? -12 : 0
  const total = signal.score + recencyScore + sourceScore + tierScore + evidenceScore + actionScore
    + proofScore + questionPenalty + coldCommunityPenalty
  return {
    ...item,
    score: total,
    signals: signal.matched,
    tags: classify(item, signal.matched),
    recency_hours: Math.round(recencyHours * 10) / 10,
  }
}

function selectEditorialCandidates(items) {
  const caps = {
    wechat: 6,
    x: 5,
    product_hunt: 6,
    reddit: 8,
    one_ms_yc: 6,
    one_ms_hn: 4,
    news: 5,
    podcast: 4,
    youtube: 8,
  }
  const used = {}
  const selected = []
  const eligibleItems = items.filter((item) => !isColdCommunityPost(item))
  const codexItems = eligibleItems
    .filter((item) => (item.tags.includes('Codex/AI编程') || item.tags.includes('Claude') || item.tags.includes('Obsidian/知识库')) && item.score >= 10)
    .slice(0, 6)
  const moneyItems = eligibleItems
    .filter((item) => item.tags.includes('赚钱案例') && item.score >= 10 && hasConcreteProof(item))
    .slice(0, 5)
  const socialItems = eligibleItems
    .filter((item) => item.tags.includes('自媒体素材') && item.score >= 10)
    .slice(0, 4)
  const priorityItems = [...codexItems, ...moneyItems, ...socialItems]
  for (const item of priorityItems) {
    if (selected.some((selectedItem) => itemKey(selectedItem) === itemKey(item))) continue
    selected.push(item)
    used[item.source_type] = (used[item.source_type] || 0) + 1
  }
  for (const item of eligibleItems) {
    if (selected.some((selectedItem) => itemKey(selectedItem) === itemKey(item))) continue
    used[item.source_type] = used[item.source_type] || 0
    if (used[item.source_type] >= (caps[item.source_type] || 4)) continue
    if (item.score < 12) continue
    selected.push(item)
    used[item.source_type] += 1
    if (selected.length >= 20) break
  }
  return selected
}

function actionPriority(item) {
  if (item.tags.includes('赚钱案例') && hasConcreteProof(item)) return '高'
  if (item.tags.includes('Codex/AI编程') || item.tags.includes('自媒体素材')) return '高'
  if (item.tags.includes('可做工具') && item.score >= 30) return '高'
  if (item.tags.includes('可做站') && item.score >= 25) return '高'
  if (item.tags.includes('商业化案例')) return '中'
  if (item.tags.includes('可写内容')) return '中'
  return '低'
}

function actionType(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase()
  if (/creator revenue|x payout|twitter payout|substack revenue|youtube revenue|newsletter revenue|payout|paid me|made \$|income report|earnings|\bmrr\b|\barr\b|赚钱|收入|收益|月入|上个月赚|创作者收益/.test(text)) {
    return '写文章'
  }
  if (/codex|openai codex|chatgpt codex|coding agent|ai coding|vibe coding|claude code|cursor|viral|views|likes|bookmarks|retweets|shares|impressions|阅读|点赞|收藏|转发/.test(text)) {
    return '写文章'
  }
  if (/fail|failed|problem|pain|control|permissions|audit|routing|workflow|ignored|costing|难|失败|痛点|权限|审计|路由/.test(text)) {
    return '解决问题'
  }
  if (item.tags.includes('可做工具') || item.tags.includes('可做站')) return '产品验证'
  if (item.tags.includes('可写内容')) return '写文章'
  return '做卡片'
}

function suggestAssetTitle(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase()
  if (/creator revenue|x payout|twitter payout|substack revenue|youtube revenue|newsletter revenue|payout|paid me|made \$|income report|earnings|\bmrr\b|\barr\b|赚钱|收入|收益|月入|上个月赚|创作者收益/.test(text)) return '赚钱案例素材：这个工具/网站/博主到底怎么赚到钱'
  if (/codex|openai codex|chatgpt codex|codex cli/.test(text)) return 'Codex 素材雷达：这条新闻/帖子可以怎么改成中文爆款内容'
  if (/claude|anthropic|claude code|claude desktop|claude artifacts/.test(text)) return 'Claude 素材雷达：这条动态可以怎么改成中文内容'
  if (/obsidian|pkm|knowledge base|second brain|zettelkasten/.test(text)) return 'Obsidian/知识库素材：AI 时代个人知识管理的新选题'
  if (/coding agent|ai coding|vibe coding|claude code|cursor|devin|windsurf|lovable|bolt\.new|replit agent/.test(text)) return 'AI 编程素材：从英文热门案例改写成中文自媒体选题'
  if (/viral|views|likes|bookmarks|retweets|shares|impressions|阅读|点赞|收藏|转发/.test(text)) return '高传播素材拆解：为什么这条内容值得翻译/改写/发公众号'
  if (/geo|generative engine optimization|ai search|chatgpt search|perplexity|answer engine|aeo|llmo|llm visibility|ai visibility|ai 爬虫|ai 搜索|生成式引擎优化|答案引擎/.test(text)) return 'GEO/AI 搜索优化：怎么让产品被 ChatGPT、Perplexity 和答案引擎引用'
  if (/support|customer support|routing|knowledge retrieval/.test(text)) return 'AI 客服不是聊天机器人，真正机会在工单路由和权限审计'
  if (/seo|visibility|impressions|clicks|traffic/.test(text)) return '一个人用 Claude 做 SEO，3 个月拿 154 万展示：AI 工具站流量飞轮'
  if (/landing page|mobile|launch|get.*ignored/.test(text)) return '为什么你的 AI 工具在 Product Hunt 没人点：移动端首屏才是第一关'
  if (/webmcp|agent-ready|navigator\.modelcontext/.test(text)) return 'WebMCP 和 agent-ready 网站：现在是机会，还是过早？'
  if (/token/.test(text)) return 'token 即产能：AI agent 成本账应该怎么重算'
  return item.title
}

function suggestOutputFormats(item, type) {
  const formats = new Set(['Obsidian 笔记'])
  if (type === '解决问题' || type === '产品验证') {
    formats.add('机会卡')
    formats.add('验证问卷')
    formats.add('MVP 需求文档')
  }
  if (type === '写文章' || item.tags.includes('可写内容') || item.score >= 25) {
    formats.add('公众号文章')
    formats.add('X 长帖')
    formats.add('小红书图文卡片')
  }
  if (type === '做卡片') formats.add('知识卡片')
  return [...formats]
}

function suggestNextStep(item, type) {
  if (type === '解决问题') return '抽取用户原话和失败场景，写成问题定义，再列 10 个潜在用户访谈问题。'
  if (type === '产品验证') return '生成一页机会卡，明确目标用户、输入输出、收费方式和 48 小时验证动作。'
  if (type === '写文章') return '用“反常识观点 + 真实案例 + 可执行清单”的结构生成公众号初稿。'
  return '压缩成一张观点卡：一句结论、一个证据、一个行动建议。'
}

function buildContentActions(editorialCandidates) {
  return editorialCandidates
    .filter((item) => !item.tags.includes('噪音') && !isColdCommunityPost(item))
    .slice(0, 12)
    .map((item) => {
      const type = actionType(item)
      return {
        id: item.id,
        source_type: item.source_type,
        source: item.source,
        title: item.title,
        asset_title: suggestAssetTitle(item),
        url: item.url,
        published_at: item.published_at,
        score: item.score,
        tags: item.tags,
        priority: actionPriority(item),
        action_type: type,
        recommended_outputs: suggestOutputFormats(item, type),
        next_step: suggestNextStep(item, type),
        skill_chain: type === '产品验证' || type === '解决问题'
          ? ['ljg-rank', 'ljg-card', 'ljg-writes']
          : ['ljg-read', 'ljg-writes', 'ljg-card'],
      }
    })
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

async function readSeen() {
  const data = await readJson(statePath, { items: {} })
  return data.items || {}
}

async function writeSeen(candidates) {
  const seen = await readSeen()
  const now = new Date().toISOString()
  for (const item of candidates) {
    const key = itemKey(item)
    seen[key] = seen[key] || { first_seen_at: now }
    seen[key].last_seen_at = now
    seen[key].title = item.title
    seen[key].url = item.url
    seen[key].source_type = item.source_type
  }
  await fs.writeFile(statePath, `${JSON.stringify({ updated_at: now, items: seen }, null, 2)}\n`)
}

async function fetchWechat() {
  try {
    const response = await fetch(wechatRssUrl)
    const xml = await response.text()
    if (!response.ok || !xml.includes('<rss')) return { items: [], error: `wechat_rss_${response.status}` }
    const itemXmls = Array.from(xml.matchAll(/<item>[\s\S]*?<\/item>/g)).map((match) => match[0])
    const items = itemXmls.map((itemXml) => {
      const rawTitle = getTag(itemXml, 'title')
      const match = rawTitle.match(/^\[(.+?)\]\s*(.+)$/)
      const content = getEncodedContent(itemXml)
      const text = htmlToText(content)
      return {
        id: getTag(itemXml, 'guid') || getTag(itemXml, 'link') || rawTitle,
        source_type: 'wechat',
        source: match?.[1] || getTag(itemXml, 'author') || '微信公众号',
        tier: ['刘小排r', '哥飞', '良辰美'].includes(match?.[1] || '') ? 'S' : 'B',
        title: match?.[2] || rawTitle,
        url: getTag(itemXml, 'link'),
        published_at: toIso(getTag(itemXml, 'pubDate')),
        summary: text.slice(0, 500),
        original_text: text,
      }
    })
    return { items, error: null }
  } catch (error) {
    return { items: [], error: String(error) }
  }
}

async function loadX() {
  const data = await readJson(xPath, { results: [] })
  const items = []
  for (const account of data.results || []) {
    for (const tweet of account.tweets || []) {
      items.push({
        id: tweet.id,
        source_type: 'x',
        source: `@${account.handle}`,
        tier: account.tier || 'A',
        title: normalizeWhitespace(tweet.text.split('\n').slice(0, 5).join(' ')).slice(0, 140),
        url: tweet.href,
        published_at: toIso(tweet.time),
        summary: normalizeWhitespace(tweet.text).slice(0, 500),
        original_text: tweet.text,
      })
    }
  }
  return items
}

async function loadOpportunities() {
  const data = await readJson(opportunityPath, { sources: {} })
  const productHunt = (data.sources?.product_hunt?.items || []).map((item) => ({
    id: item.url,
    source_type: 'product_hunt',
    source: item.source,
    tier: 'A',
    title: item.title,
    url: item.url,
    published_at: toIso(item.published_at),
    summary: item.summary || item.title,
    upvotes: item.upvotes,
    comments: item.comments,
  }))
  const reddit = (data.sources?.reddit?.items || []).map((item) => ({
    id: item.url,
    source_type: 'reddit',
    source: item.source,
    tier: 'A',
    title: item.title,
    url: item.url,
    published_at: toIso(item.published_at),
    summary: item.summary || item.title,
    discussion_status: item.discussion_status,
  }))
  const oneMs = (data.sources?.one_ms_news?.items || []).map((item) => ({
    id: item.url,
    source_type: item.type,
    source: item.source,
    tier: item.type === 'one_ms_yc' ? 'S' : 'A',
    title: item.title,
    url: item.url,
    published_at: toIso(item.published_at),
    summary: item.summary || item.title,
  }))
  const feeds = (data.sources?.feeds?.items || []).map((item) => ({
    id: item.url,
    source_type: item.type === 'podcast' ? 'podcast' : 'news',
    source: item.source,
    tier: item.source === 'OpenAI Developers' || item.source.startsWith('Anthropic News') ? 'S' : 'A',
    title: item.title,
    url: item.url,
    published_at: toIso(item.published_at),
    summary: item.summary || item.title,
  }))
  const youtube = (data.sources?.youtube?.items || []).map((item) => ({
    id: item.url,
    source_type: 'youtube',
    source: item.source,
    tier: 'A',
    title: item.title,
    url: item.url,
    published_at: toIso(item.published_at),
    summary: item.summary || item.title,
  }))
  return [...productHunt, ...reddit, ...oneMs, ...feeds, ...youtube]
}

function dedupe(items) {
  const seen = new Map()
  for (const item of items) {
    const key = item.url || `${item.source_type}:${item.title.toLowerCase()}`
    const current = seen.get(key)
    if (!current || (item.score || 0) > (current.score || 0)) seen.set(key, item)
  }
  return [...seen.values()]
}

function markdown(candidates, freshCandidates, editorialCandidates, sourceStatus, contentActions) {
  const top = candidates.slice(0, 15)
  const fresh = freshCandidates.slice(0, 10)
  const editorial = editorialCandidates.slice(0, 15)
  const lines = [
    `# AI 出海候选日报`,
    '',
    `生成时间：${new Date().toISOString()}`,
    `模式：${mode === 'commit' ? '已写入 seen' : '预览，不写入 seen'}`,
    '',
    '## 抓取状态',
    `- 微信公众号：${sourceStatus.wechat}`,
    `- X/Twitter：${sourceStatus.x}`,
    `- Product Hunt：${sourceStatus.product_hunt}`,
    `- Reddit：${sourceStatus.reddit}`,
    `- 1ms YC Launch：${sourceStatus.one_ms_yc}`,
    `- 1ms HN 72h：${sourceStatus.one_ms_hn}`,
    `- News：${sourceStatus.news}`,
    `- Podcast：${sourceStatus.podcast}`,
    `- YouTube：${sourceStatus.youtube}`,
    '',
    '## 最新未读高分候选',
    ...(fresh.length ? fresh.map((item, index) => [
      `${index + 1}. [${item.title}](${item.url})`,
      `   - 来源：${item.source} / ${item.source_type} / score=${item.score} / ${item.tags.join(', ') || '未分类'}`,
      `   - 时间：${item.published_at || '未知'}`,
      `   - 摘要：${item.summary}`,
    ].join('\n')) : ['暂无最新未读候选。']),
    '',
    '## 建议进入邮件的候选',
    ...(editorial.length ? editorial.map((item, index) => [
      `${index + 1}. [${item.title}](${item.url})`,
      `   - 来源：${item.source} / ${item.source_type} / score=${item.score} / ${item.tags.join(', ') || '未分类'}`,
      `   - 时间：${item.published_at || '未知'}`,
      `   - 摘要：${item.summary}`,
    ].join('\n')) : ['暂无建议进入邮件的候选。']),
    '',
    '## 下一步资产动作',
    ...(contentActions.length ? contentActions.slice(0, 10).map((action, index) => [
      `${index + 1}. ${action.asset_title}`,
      `   - 动作：${action.action_type} / 优先级：${action.priority} / 输出：${action.recommended_outputs.join('、')}`,
      `   - 下一步：${action.next_step}`,
      `   - 链接：${action.url}`,
    ].join('\n')) : ['暂无下一步资产动作。']),
    '',
    '## 全量高分候选',
    ...top.map((item, index) => [
      `${index + 1}. [${item.title}](${item.url})`,
      `   - 来源：${item.source} / ${item.source_type} / score=${item.score} / ${item.tags.join(', ') || '未分类'}`,
      `   - 时间：${item.published_at || '未知'}`,
    ].join('\n')),
    '',
  ]
  return `${lines.join('\n')}\n`
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true })
  const [wechatResult, xItems, opportunityItems, seen] = await Promise.all([
    fetchWechat(),
    loadX(),
    loadOpportunities(),
    readSeen(),
  ])
  const all = dedupe([...wechatResult.items, ...xItems, ...opportunityItems].map(scoreItem))
    .filter((item) => item.score >= 8)
    .sort((a, b) => b.score - a.score || new Date(b.published_at) - new Date(a.published_at))

  const fresh = all.filter((item) => !seen[itemKey(item)])
  const editorial = selectEditorialCandidates(fresh.length ? fresh : all)
  const contentActions = buildContentActions(editorial)
  const sourceStatus = {
    wechat: wechatResult.error ? `失败：${wechatResult.error}` : `${wechatResult.items.length} 条`,
    x: `${xItems.length} 条`,
    product_hunt: `${opportunityItems.filter((item) => item.source_type === 'product_hunt').length} 条`,
    reddit: `${opportunityItems.filter((item) => item.source_type === 'reddit').length} 条`,
    one_ms_yc: `${opportunityItems.filter((item) => item.source_type === 'one_ms_yc').length} 条`,
    one_ms_hn: `${opportunityItems.filter((item) => item.source_type === 'one_ms_hn').length} 条`,
    news: `${opportunityItems.filter((item) => item.source_type === 'news').length} 条`,
    podcast: `${opportunityItems.filter((item) => item.source_type === 'podcast').length} 条`,
    youtube: `${opportunityItems.filter((item) => item.source_type === 'youtube').length} 条`,
  }

  const payload = {
    generated_at: new Date().toISOString(),
    mode,
    source_status: sourceStatus,
    counts: {
      candidates: all.length,
      fresh: fresh.length,
      editorial: editorial.length,
    },
    fresh_candidates: fresh.slice(0, 20),
    editorial_candidates: editorial,
    content_actions: contentActions,
    candidates: all.slice(0, 50),
  }
  await fs.writeFile(candidatesPath, `${JSON.stringify(payload, null, 2)}\n`)
  await fs.writeFile(actionsPath, `${JSON.stringify({
    generated_at: payload.generated_at,
    mode,
    source_status: sourceStatus,
    content_actions: contentActions,
  }, null, 2)}\n`)
  await fs.writeFile(publicReportPath, `${JSON.stringify(payload, null, 2)}\n`)
  const mdContent = markdown(all, fresh, editorial, sourceStatus, contentActions)
  await fs.writeFile(markdownPath, mdContent)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [{ value: mm }, , { value: dd }, , { value: yyyy }] = formatter.formatToParts(new Date())
  const dateStr = `${yyyy}-${mm}-${dd}`


  const archiveDir = path.join(projectRoot, 'public/archive')
  await fs.mkdir(archiveDir, { recursive: true })

  const publicBriefPath = path.join(projectRoot, 'public/brief.md')
  const archiveBriefPath = path.join(archiveDir, `brief-${dateStr}.md`)

  await fs.writeFile(publicBriefPath, mdContent)
  await fs.writeFile(archiveBriefPath, mdContent)

  const listJsonPath = path.join(archiveDir, 'list.json')
  let list = []
  try {
    const listRaw = await fs.readFile(listJsonPath, 'utf8')
    list = JSON.parse(listRaw)
  } catch (e) {
    list = []
  }
  if (!list.includes(dateStr)) {
    list.push(dateStr)
    list.sort((a, b) => b.localeCompare(a))
    await fs.writeFile(listJsonPath, JSON.stringify(list, null, 2))
  }

  if (mode === 'commit') await writeSeen(editorial)
  console.log(candidatesPath)
  console.log(markdownPath)
  console.log(`candidates=${all.length}, fresh=${fresh.length}, editorial=${editorial.length}, mode=${mode}`)
}

await main()

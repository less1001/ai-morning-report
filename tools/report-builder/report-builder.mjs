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
const opportunityCardsPath = path.join(outputDir, 'opportunity-cards.json')
const xPath = path.join(projectRoot, 'tools/x-monitor/data/latest.json')
const opportunityPath = path.join(projectRoot, 'tools/opportunity-monitor/data/latest.json')
const wechatRssUrl = 'http://localhost:5010/api/rss/all'

const mode = process.argv.includes('--commit') ? 'commit' : 'preview'

const editorialMaxAgeHours = {
  wechat: 168,
  x: 72,
  product_hunt: 72,
  reddit: 72,
  one_ms_yc: 168,
  one_ms_hn: 72,
  news: 168,
  podcast: 168,
  youtube: 168,
}

const maxEditorialItems = 12
const maxEmailMaterials = 4

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
    const term = keyword.trim().toLowerCase()
    const isEnglishTerm = /^[a-z0-9][a-z0-9 .$/-]*$/.test(term)
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = isEnglishTerm
      ? new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalized)
      : normalized.includes(term)
    if (matches) {
      score += weight
      matched.push(term)
    }
  }
  for (const keyword of negativeSignals) {
    if (normalized.includes(keyword.toLowerCase())) score -= 4
  }
  return { score, matched: [...new Set(matched)] }
}

function audienceSignal(text = '') {
  const metricText = text
    .replace(/(?:\$|usd\s*|us\$\s*|¥\s*)\d[\d,.]*(?:\s*(?:k|m|万|千))?/gi, ' ')
    .replace(/\d[\d,.]*(?:\s*(?:k|m|万|千))?\s*(?:美元|美金|人民币|元)/gi, ' ')
  const values = []
  for (const match of metricText.matchAll(/(\d+(?:\.\d+)?)\s*万/g)) values.push(Number(match[1]) * 10000)
  for (const match of metricText.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)) values.push(Number(match[0].replaceAll(',', '')))
  return values.length ? Math.max(...values) : 0
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
  if (moneyCase && !cryptoRightsNoise && hasRevenueProof(item)) tags.push('赚钱案例')
  if (item.source_type === 'podcast') tags.push('播客')
  if (item.source_type === 'youtube') tags.push('YouTube')
  if (item.source_type === 'news') tags.push('新闻')
  if (/viral|views|likes|bookmarks|retweets|shares|impressions|comments|百万|几十万|阅读|点赞|收藏|转发|评论/.test(text)) tags.push('自媒体素材')
  if (/geo|generative engine optimization|ai search|chatgpt search|perplexity|answer engine|aeo|llmo|llm visibility|ai visibility|ai 爬虫|ai 搜索|生成式引擎优化|答案引擎/.test(text)) tags.push('GEO')
  if (/agent|workflow|mcp|automation|tool|工具/.test(text)) tags.push('可做工具')
  if (/\bsite\b|\bwebsite\b|seo|geo|traffic|visibility|独立站|流量/.test(text)) tags.push('可做站')
  if (/case|mrr|revenue|8k|3k|案例|变现/.test(text)) tags.push('商业化案例')
  if (/prompt|说话|表达|content|newsletter|小红书|公众号/.test(text)) tags.push('可写内容')
  if (/token|btc|币安|mstr|徽章|crypto/.test(text)) tags.push('只观察')
  if (!tags.length && matchedSignals.length) tags.push('只观察')
  return [...new Set(tags)]
}

function hasConcreteProof(item) {
  const text = `${item.title} ${item.summary || ''}`.toLowerCase()
  if (hasRevenueProof(item)) return true
  const amountBeforeMetric = /\d+(?:\.\d+)?\s*(?:k|m|万|千)?\s*(?:registered users|daily active users|monthly active users|users|customers|impressions|clicks|traffic|visits|comments|upvotes|用户|客户|访问|评论|点击|展示)/.test(text)
  const metricBeforeAmount = /(?:registered users|daily active users|monthly active users|users|customers|impressions|clicks|traffic|visits|comments|upvotes|用户|客户|访问|评论|点击|展示)\s*(?:[:：=]|reached?|grew to|超过|达到|有)\s*\d+(?:\.\d+)?\s*(?:k|m|万|千)?/.test(text)
  return amountBeforeMetric || metricBeforeAmount
}

function hasRevenueProof(item) {
  const text = `${item.title} ${item.summary || ''}`.toLowerCase()
  const amountBeforeMetric = /(?:\$|usd\s*|us\$\s*|人民币\s*|¥\s*)?\d[\d,.]*(?:\s*(?:k|m|万|千))?\s*(?:美元|美金|元|人民币)?[^。；;\n]{0,12}(?:mrr|arr|revenue|income|earnings|payout|月收入|年收入|收入|收益|营收)/.test(text)
  const metricBeforeAmount = /(?:mrr|arr|revenue|income|earnings|payout|月收入|年收入|收入|收益|营收)[^。；;\n]{0,24}(?:\$|usd\s*|us\$\s*|人民币\s*|¥\s*)?\d[\d,.]*(?:\s*(?:k|m|万|千))?/.test(text)
  return amountBeforeMetric || metricBeforeAmount
}

function revenueEvidenceType(item) {
  if (!hasRevenueProof(item)) return '无金额证据'
  const text = itemText(item)
  if (/estimate|estimated|estimate based on|推算|估算|预估|测算/.test(text)) return '估算'
  if (/i made|i earned|our revenue|founder reports?|creator reports?|创始人披露|作者披露|本人披露|上个月赚/.test(text)) return '当事人披露'
  if (/stripe|dashboard|receipt|payout statement|后台截图|收款截图|付款记录/.test(text)) return '公开凭证'
  return '第三方披露'
}

function itemRecencyHours(item, now = Date.now()) {
  if (!item.published_at) return Number.POSITIVE_INFINITY
  const publishedAt = new Date(item.published_at).valueOf()
  if (Number.isNaN(publishedAt)) return Number.POSITIVE_INFINITY
  return Math.max(0, (now - publishedAt) / 36e5)
}

function maxEditorialAge(item) {
  return editorialMaxAgeHours[item.source_type] || 72
}

function hasActionableDetail(item) {
  const text = normalizeWhitespace(`${item.title} ${item.summary || ''} ${item.original_text || ''}`)
  const actionablePattern = /built|launched|experiment|workflow|customers|users|used by|case study|before|after|step|plugin|deployment|agent|automation|增长|实验|工作流|客户|用户|发布|上线|步骤|插件|部署|代理|自动化/i
  return text.length >= 100 && (actionablePattern.test(text) || hasConcreteProof(item))
}

function hasHistoricalContextWarning(item) {
  if (!item.published_at) return false
  const publishedYear = new Date(item.published_at).getUTCFullYear()
  const text = `${item.summary || ''} ${item.original_text || ''}`
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]))
  return years.some((year) => year < publishedYear)
}

function isPublishableCandidate(item) {
  const validUrl = /^https:\/\//.test(item.url || '')
  const recency = itemRecencyHours(item)
  const questionOnly = /^(any good|what |why |how do i|should i|is there|could there|are the)/i.test(item.title || '')
  return validUrl
    && recency <= maxEditorialAge(item)
    && !questionOnly
    && hasActionableDetail(item)
}

function primarySection(item) {
  if (item.tags.includes('赚钱案例')) return '赚钱案例/创作者收益'
  if (item.tags.includes('Codex/AI编程') || item.tags.includes('Claude') || item.tags.includes('Obsidian/知识库')) return 'Codex/Claude/AI编程'
  if (item.source_type === 'reddit' || item.source_type === 'one_ms_hn') return 'Reddit/社区痛点'
  if (item.tags.includes('GEO')) return 'GEO/AI搜索优化'
  if (['news', 'podcast', 'youtube'].includes(item.source_type) || ['@OpenAI', '@AnthropicAI', '@sama', '@karpathy', '@emollick', '@AravSrinivas'].includes(item.source)) return '行业领袖/新闻/播客'
  return 'AI工具与出海机会'
}

function itemText(item) {
  return `${item.title || ''} ${item.summary || ''} ${item.original_text || ''}`.toLowerCase()
}

function opportunityTrack(item) {
  const text = itemText(item)
  if (/affiliate|referral|commission|联盟营销|佣金|返佣/.test(text)) return 'Affiliate联盟营销'
  if (/youtube|tiktok|short drama|newsletter|creator|content product|漫剧|短剧|视频号|内容产品|ai写作|ai图片|ai视频/.test(text)) return 'AI内容产品'
  if (/chrome extension|browser extension|shopify app|wordpress plugin|telegram bot|discord bot|desktop app|mobile app|小程序|浏览器插件|扩展程序|桌面应用|手机应用|机器人/.test(text)) return '自由机会'
  if (/enterprise|\bb2b\b|customer support|sales automation|operations automation|enterprise agent|企业|团队工作流|销售自动化|客服|运营自动化/.test(text)) return '企业Agent服务'
  if (/free online|free tool|calculator|converter|remover|generator|seo|adsense|programmatic|免费工具|工具站|计算器|转换器|去除|生成器/.test(text)) return '免费工具站'
  if (/\bsaas\b|\bmrr\b|\barr\b|subscription|micro saas|microsaas|订阅|按量付费/.test(text)) return '微型SaaS'
  return '自由机会'
}

function trafficEntry(item) {
  const text = itemText(item)
  if (/google ads|adwords|paid search|ppc|付费搜索|广告投放/.test(text)) return 'Google Ads'
  if (/seo|organic search|keyword|search traffic|程序化页面|自然搜索|关键词/.test(text)) return 'Google SEO'
  if (/chrome web store|chrome extension|browser extension|shopify app store|wordpress|app store|google play|插件市场|应用商店|浏览器插件|扩展程序/.test(text)) return '应用与插件市场'
  if (/github|open source|开源/.test(text)) return 'GitHub'
  if (/product hunt/.test(text)) return 'Product Hunt'
  if (/reddit|hacker news|show hn|community|slack|discord|社区/.test(text)) return '社区'
  if (/youtube|tiktok|instagram|threads|twitter|x\.com|social|小红书|公众号|社媒/.test(text)) return '社媒内容'
  if (/outbound|cold email|sales-led|主动销售|冷邮件/.test(text)) return '主动销售'
  if (/affiliate|partner|联盟|合作伙伴/.test(text)) return 'Affiliate合作'
  return '待验证'
}

function monetizationModel(item) {
  const text = itemText(item)
  if (item.revenue_proof) return '已披露收入，需核验口径'
  if (/affiliate|referral|commission|联盟|佣金/.test(text)) return 'Affiliate佣金'
  if (/adsense|display ads|ad revenue|广告收入/.test(text)) return 'AdSense与广告'
  if (/subscription|\bmrr\b|\barr\b|\bsaas\b|订阅/.test(text)) return '订阅与按量付费'
  if (/youtube|creator|newsletter|漫剧|短剧|内容产品/.test(text)) return '平台分成、赞助、会员或内容付费'
  if (/enterprise|b2b|service|agency|consulting|企业|服务|代运营/.test(text)) return '企业服务与项目费'
  if (/free tool|免费工具|generator|converter|remover/.test(text)) return '免费获客后转订阅、广告或联盟'
  return '待验证'
}

function hasProductGrowthEvidence(item) {
  const text = itemText(item)
  return item.revenue_proof
    || /\d+(?:\.\d+)?\s*(?:k|m|万|千)?\s*(?:registered users|daily active users|monthly active users|paying users|users|customers|用户|付费用户|客户)/.test(text)
    || /(?:registered users|daily active users|monthly active users|paying users|users|customers|用户|付费用户|客户)\s*(?:[:：=]|reached?|grew to|超过|达到|有)\s*\d+(?:\.\d+)?\s*(?:k|m|万|千)?/.test(text)
}

function isUnsafeOpportunity(item) {
  return /刷流量|刷量|fake traffic|click fraud|虚假点击|伪造流量|操纵similarweb|manipulat(?:e|ing) similarweb/.test(itemText(item))
}

function hasOpportunityShape(item) {
  const text = itemText(item)
  return /\bsaas\b|micro saas|website|web app|free tool|chrome extension|browser extension|plugin|mobile app|desktop app|api\b|platform|generator|converter|remover|calculator|workflow|automation|newsletter|youtube channel|网站|工具站|浏览器插件|扩展程序|小程序|应用|插件|平台|生成器|转换器|去除工具|计算器|工作流|自动化/.test(text)
}

function hasLaunchEvidence(item) {
  const text = itemText(item)
  return /\bbuilt\b|\blaunched\b|\bshipped\b|\breleased\b|used by|case study|发布|上线|推出|实测|案例/.test(text)
    || ['product_hunt', 'one_ms_yc'].includes(item.source_type)
}

function isOpportunityReady(item) {
  if (isUnsafeOpportunity(item) || !hasOpportunityShape(item)) return false
  const questionPrompt = /\?/.test(item.title || '')
  if (questionPrompt && !hasProductGrowthEvidence(item) && !hasLaunchEvidence(item)) return false
  const hasDistribution = trafficEntry(item) !== '待验证'
  const hasCommercialModel = monetizationModel(item) !== '待验证'
  return hasProductGrowthEvidence(item)
    || hasDiscussionSignal(item)
    || hasLaunchEvidence(item)
    || hasDistribution
    || hasCommercialModel
}

function opportunityMaturity(item) {
  if (item.revenue_proof) return '已有人赚钱'
  if (hasProductGrowthEvidence(item)) return '正在增长'
  if (hasDiscussionSignal(item)) return '需求已验证'
  if (hasLaunchEvidence(item)) return '可以开发'
  return '新信号'
}

function opportunityWindow(item) {
  const text = itemText(item)
  if (item.recency_hours <= 24 && /new|launch|trend|viral|刚发布|上线|热点|爆火|水印|兼容/.test(text)) return '48小时窗口'
  if (item.recency_hours <= 72 && /launch|plugin|extension|tool|agent|发布|插件|工具/.test(text)) return '7天窗口'
  if (/seo|affiliate|adsense|saas|workflow|搜索|联盟|订阅|工作流/.test(text)) return '长期机会'
  return '30天窗口'
}

function recommendedToolchain(item) {
  const text = itemText(item)
  if (/chrome extension|browser extension|浏览器插件|扩展程序/.test(text)) return ['Codex', 'Claude Code', 'Cursor', 'Playwright']
  if (/video|youtube|漫剧|短剧|视频/.test(text)) return ['Claude', 'Codex', '主流图像与视频模型', '自动化发布工具']
  if (/image|design|图片|设计/.test(text)) return ['Claude', 'Codex', '主流图像模型', 'Playwright']
  if (/mobile app|app store|google play|手机应用|小程序/.test(text)) return ['Codex', 'Claude Code', 'Cursor', '平台原生开发工具']
  if (/landing page|website|site|seo|saas|tool|网站|工具/.test(text)) return ['Codex', 'Claude Code', 'Cursor', '浏览器验收工具']
  return ['Codex', 'Claude Code', 'Cursor', '按任务选择的专业模型']
}

function strongestObjection(item) {
  const track = opportunityTrack(item)
  const traffic = trafficEntry(item)
  if (traffic === '待验证') return '尚未找到可重复的第一流量入口，做出产品也可能无人访问。'
  if (track === 'Affiliate联盟营销') return '佣金、品牌词投放和广告政策可能让表面成立的单位经济失效。'
  if (track === '免费工具站') return '搜索竞争、平台替代和广告单价可能不足以覆盖持续维护。'
  if (track === 'AI内容产品') return '平台分发波动与内容同质化可能让产能提升无法转成收入。'
  if (track === '企业Agent服务') return '销售周期、权限和集成成本可能高于独立开发者可承受范围。'
  if (track === '微型SaaS') return '用户可能认可问题，却不愿为持续订阅付费。'
  return '产品形态新颖不等于需求成立，需要先验证真实使用频率和付费意愿。'
}

function assetFit(item) {
  const track = opportunityTrack(item)
  return {
    reusable_code: ['微型SaaS', '免费工具站', '自由机会'].includes(track),
    reusable_traffic: trafficEntry(item) !== '待验证',
    publishable_content: item.publishable,
    knowledge_planet_asset: true,
    portfolio_entry: ['微型SaaS', '免费工具站', 'Affiliate联盟营销', '自由机会'].includes(track),
  }
}

function decisionScore(item) {
  const text = itemText(item)
  const track = opportunityTrack(item)
  const traffic = trafficEntry(item)
  const targetFit = /\bai\b|agent|\bsaas\b|tool|website|\bseo\b|affiliate|creator|content|automation|人工智能|工具|网站|出海|内容|自动化/.test(text) ? 25 : 10
  const buildability = /\btool\b|\bsite\b|website|plugin|extension|\bapp\b|\bapi\b|workflow|generator|converter|remover|工具|网站|插件|应用|工作流/.test(text) ? 20 : track === '企业Agent服务' ? 12 : 8
  const monetization = item.revenue_proof ? 20 : monetizationModel(item) !== '待验证' ? 12 : 4
  const demand = hasProductGrowthEvidence(item) ? 15 : hasDiscussionSignal(item) || hasLaunchEvidence(item) ? 10 : 4
  const distribution = traffic !== '待验证' ? 10 : 2
  const content = item.tags.includes('自媒体素材') || item.audience_signal >= 10000 ? 10 : item.publishable ? 6 : 2
  return {
    total: targetFit + buildability + monetization + demand + distribution + content,
    breakdown: { target_fit: targetFit, buildability, monetization, demand, distribution, content },
  }
}

function enrichOpportunity(item) {
  const decision = decisionScore(item)
  const aiEnabled = /\bai\b|artificial intelligence|agent|llm|codex|claude|人工智能|智能体/.test(itemText(item))
  const opportunityEligible = isOpportunityReady(item)
  return {
    ...item,
    opportunity_track: opportunityTrack(item),
    opportunity_maturity: opportunityMaturity(item),
    opportunity_window: opportunityWindow(item),
    primary_traffic_entry: trafficEntry(item),
    monetization_model: monetizationModel(item),
    ai_money_case: Boolean(aiEnabled && item.revenue_proof),
    revenue_evidence_type: revenueEvidenceType(item),
    opportunity_eligible: opportunityEligible,
    eligibility_checks: {
      product_shape: hasOpportunityShape(item),
      evidence_gate: hasProductGrowthEvidence(item) || hasDiscussionSignal(item) || hasLaunchEvidence(item) || trafficEntry(item) !== '待验证' || monetizationModel(item) !== '待验证',
      ethical_gate: !isUnsafeOpportunity(item),
    },
    evidence_status: item.revenue_proof ? `${revenueEvidenceType(item)}，金额待原文核验` : hasConcreteProof(item) ? '事实待原文核验' : '新信号',
    economic_model: {
      status: '待验证',
      required_inputs: ['1000访问获取成本', '访问到激活转化率', '激活到付费或广告转化率', '客单价或广告RPM', '单次服务成本'],
      formula: '收入=访问量×转化率×客单价；利润=收入-获客成本-模型与基础设施成本',
    },
    competition_window: {
      why_now: opportunityWindow(item),
      giant_gap: '需核验巨头为何尚未覆盖或为何不愿服务该细分需求',
      closing_signal: '搜索结果快速拥挤、平台原生补齐功能或获客成本超过单用户价值',
    },
    asset_fit: assetFit(item),
    strongest_objection: strongestObjection(item),
    recommended_toolchain: recommendedToolchain(item),
    decision_score: decision.total,
    decision_score_breakdown: decision.breakdown,
  }
}

function titleTokens(item) {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'are', 'our', 'new', 'ai'])
  return new Set(
    `${item.title} ${item.summary || ''}`
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .match(/[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}/g)
      ?.filter((token) => !stopWords.has(token)) || [],
  )
}

function isNearDuplicate(left, right) {
  if (left.source !== right.source) return false
  const leftTime = new Date(left.published_at || 0).valueOf()
  const rightTime = new Date(right.published_at || 0).valueOf()
  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && Math.abs(leftTime - rightTime) <= 60_000) return true
  const leftTokens = titleTokens(left)
  const rightTokens = titleTokens(right)
  if (!leftTokens.size || !rightTokens.size) return false
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.55
}

function emailRank(item) {
  let rank = item.score
  if (item.tags.includes('Codex/AI编程') || item.tags.includes('Claude')) rank += 8
  if (item.revenue_proof) rank += 7
  if (item.tier === 'S') rank += 5
  if (['reddit', 'product_hunt'].includes(item.source_type)) rank -= 4
  if (/\?$/.test(item.title || '')) rank -= 3
  return rank
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
  const recencyHours = itemRecencyHours(item)
  const recencyScore = recencyHours <= 12 ? 6 : recencyHours <= 36 ? 4 : recencyHours <= 72 ? 2 : recencyHours <= 168 ? 0 : -20
  const sourceScore = sourceWeights[item.source_type] || 0
  const tierScore = tierWeights[item.tier] || 0
  const evidenceScore = item.url ? 2 : 0
  const lower = combined.toLowerCase()
  const actionScore = /mrr|revenue|waiting|built|launch|template|workflow|agent|mcp|seo|visibility|8k|\$|case study|customers|用户|访问|收入/.test(lower) ? 3 : 0
  const proofScore = /mrr|revenue|\$\d|k\/mo|users|customers|traffic|访问|收入|用户|月/.test(lower) ? 4 : 0
  const audience = audienceSignal(combined)
  const audienceScore = audience >= 100000 ? 5 : audience >= 10000 ? 3 : audience >= 1000 ? 1 : 0
  const questionPenalty = /^(any good|what beginner|looking for|how do i|should i|is there)/i.test(item.title) ? -5 : 0
  const coldCommunityPenalty = isColdCommunityPost(item) ? -12 : 0
  const total = signal.score + recencyScore + sourceScore + tierScore + evidenceScore + actionScore
    + proofScore + audienceScore + questionPenalty + coldCommunityPenalty
  const scored = {
    ...item,
    score: total,
    signals: signal.matched,
    tags: classify(item, signal.matched),
    recency_hours: Math.round(recencyHours * 10) / 10,
  }
  return enrichOpportunity({
    ...scored,
    publishable: isPublishableCandidate(scored),
    revenue_proof: hasRevenueProof(scored),
    historical_context_warning: hasHistoricalContextWarning(scored),
    primary_section: primarySection(scored),
    audience_signal: audience,
  })
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
  const eligibleItems = items.filter((item) => item.publishable && !isColdCommunityPost(item))
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
    if (selected.some((selectedItem) => isNearDuplicate(selectedItem, item))) continue
    selected.push(item)
    used[item.source_type] = (used[item.source_type] || 0) + 1
  }
  for (const item of eligibleItems) {
    if (selected.some((selectedItem) => itemKey(selectedItem) === itemKey(item))) continue
    if (selected.some((selectedItem) => isNearDuplicate(selectedItem, item))) continue
    used[item.source_type] = used[item.source_type] || 0
    if (used[item.source_type] >= (caps[item.source_type] || 4)) continue
    if (item.score < 12) continue
    selected.push(item)
    used[item.source_type] += 1
    if (selected.length >= maxEditorialItems) break
  }
  return selected.slice(0, maxEditorialItems)
}

function buildOpportunityCards(items) {
  return items
    .filter((item) => item.publishable && !isColdCommunityPost(item) && item.opportunity_eligible && item.decision_score >= 55)
    .sort((left, right) => right.decision_score - left.decision_score || emailRank(right) - emailRank(left))
    .filter((item, index, sorted) => sorted.findIndex((candidate) => itemKey(candidate) === itemKey(item)) === index)
    .slice(0, 30)
}

function buildEmailPlan(editorialCandidates, contentActions, opportunityCards = buildOpportunityCards(editorialCandidates)) {
  const cards = opportunityCards.slice(0, 20)
  const usedUrls = new Set()
  const takeCard = (predicate) => {
    const item = cards.find((candidate) => !usedUrls.has(candidate.url) && predicate(candidate)) || null
    if (item) usedUrls.add(item.url)
    return item
  }
  const takeEditorial = (predicate) => {
    const item = [...editorialCandidates]
      .sort((left, right) => emailRank(right) - emailRank(left))
      .find((candidate) => !usedUrls.has(candidate.url) && predicate(candidate)) || null
    if (item) usedUrls.add(item.url)
    return item
  }
  const mainOpportunity = takeCard((item) => item.decision_score >= 70
    && item.decision_score_breakdown.buildability >= 20
    && (item.primary_traffic_entry !== '待验证' || hasProductGrowthEvidence(item) || item.revenue_proof))
  const moneyCase = takeCard((item) => item.ai_money_case)
  const publishableStory = takeEditorial((item) => {
    const questionOnly = /^(any|what|which|why|how|should|is|are|can|could|would)\b/i.test(item.title || '')
    const relevant = item.tags.some((tag) => ['Codex/AI编程', 'Claude', '赚钱案例', '自媒体素材', 'GEO', '商业化案例', '可做工具', '可做站', '新闻'].includes(tag))
    const supported = item.tier === 'S' || item.revenue_proof || item.audience_signal >= 10000 || hasDiscussionSignal(item)
    return item.publishable && !questionOnly && !isUnsafeOpportunity(item) && relevant && supported
  })
  const wildCard = takeCard((item) => item.opportunity_track === '自由机会' && item.decision_score >= 65 && item.score >= 20)
  const selected = [mainOpportunity, moneyCase, publishableStory, wildCard].filter(Boolean).slice(0, maxEmailMaterials)
  const topStory = publishableStory || mainOpportunity || selected[0] || null
  const mainAction = contentActions.find((action) => action.url === mainOpportunity?.url)
  return {
    version: 2,
    purpose: '邮件只负责决策；完整研究看opportunity_cards；原始信息看candidates。',
    unique_material_count: selected.length,
    decision_card_count: selected.length,
    main_opportunity: mainOpportunity,
    money_case: moneyCase,
    publishable_story: publishableStory,
    wild_card: wildCard,
    today_action: mainOpportunity ? {
      evidence_url: mainOpportunity.url,
      action: mainAction?.next_step || '验证第一流量入口，完成最小页面或可点击原型。',
      timebox: mainOpportunity.opportunity_window,
      pass_metric: '拿到真实目标用户行为、回复、安装、下载或付费信号；只有点赞不算通过。',
    } : null,
    knowledge_planet_asset: mainOpportunity ? {
      evidence_url: mainOpportunity.url,
      asset: '机会卡、证据清单、经济模型、工具链、48小时验证记录',
    } : null,
    top_story: topStory,
    section_items: {},
    evidence_index: selected.map((item) => ({ title: item.title, url: item.url, published_at: item.published_at })),
    opportunity_candidates: mainOpportunity ? [mainOpportunity] : [],
    source_status_in_email: false,
  }
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
        title: normalizeWhitespace(tweet.text.split('\n').slice(0, 5).join(' ')).slice(0, 140).trim(),
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
  return `${lines.join('\n').replace(/[ \t]+$/gm, '')}\n`
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
  const opportunityCards = buildOpportunityCards(fresh.length ? fresh : all)
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
      publishable: all.filter((item) => item.publishable).length,
      opportunity_cards: opportunityCards.length,
      unique_email_materials: buildEmailPlan(editorial, contentActions, opportunityCards).unique_material_count,
    },
    fresh_candidates: fresh.slice(0, 20),
    editorial_candidates: editorial,
    content_actions: contentActions,
    opportunity_cards: opportunityCards,
    email_plan: buildEmailPlan(editorial, contentActions, opportunityCards),
    candidates: all.slice(0, 50),
  }
  await fs.writeFile(candidatesPath, `${JSON.stringify(payload, null, 2)}\n`)
  await fs.writeFile(actionsPath, `${JSON.stringify({
    generated_at: payload.generated_at,
    mode,
    source_status: sourceStatus,
    content_actions: contentActions,
  }, null, 2)}\n`)
  await fs.writeFile(opportunityCardsPath, `${JSON.stringify({
    generated_at: payload.generated_at,
    mode,
    opportunity_cards: opportunityCards,
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}

export {
  buildEmailPlan,
  buildOpportunityCards,
  enrichOpportunity,
  hasRevenueProof,
  isPublishableCandidate,
  itemRecencyHours,
  isNearDuplicate,
  primarySection,
}

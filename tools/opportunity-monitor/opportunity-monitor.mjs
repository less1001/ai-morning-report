import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const outputPath = path.join(dataDir, 'latest.json')

const headers = {
  'user-agent': 'Mozilla/5.0 ai-outbound-monitor/1.0',
  accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const redditSources = [
  { id: 'Codex_programming', url: 'https://www.reddit.com/search.rss?q=OpenAI%20Codex%20OR%20ChatGPT%20Codex%20OR%20codex%20cli%20OR%20AI%20coding%20OR%20coding%20agent%20OR%20vibe%20coding&sort=comments&t=day' },
  { id: 'Claude_programming', url: 'https://www.reddit.com/search.rss?q=Claude%20Code%20OR%20Claude%20AI%20OR%20Anthropic%20OR%20MCP%20OR%20Claude%20Desktop%20OR%20Claude%20Artifacts&sort=comments&t=day' },
  { id: 'Obsidian_AI', url: 'https://www.reddit.com/search.rss?q=Obsidian%20AI%20OR%20Obsidian%20Claude%20OR%20Obsidian%20ChatGPT%20OR%20PKM%20AI%20OR%20knowledge%20base%20LLM&sort=comments&t=week' },
  { id: 'Creator_Revenue', url: 'https://www.reddit.com/search.rss?q=creator%20revenue%20OR%20X%20payout%20OR%20Twitter%20payout%20OR%20Substack%20revenue%20OR%20YouTube%20revenue%20OR%20newsletter%20revenue%20OR%20made%20%24%20with%20AI&sort=comments&t=week' },
  { id: 'AI_Money_Cases', url: 'https://www.reddit.com/search.rss?q=AI%20tool%20MRR%20OR%20AI%20website%20revenue%20OR%20made%20money%20with%20AI%20OR%20micro%20SaaS%20revenue%20OR%20indie%20hacker%20MRR&sort=comments&t=week' },
  { id: 'Codex_ChatGPT', url: 'https://www.reddit.com/r/ChatGPT/search.rss?q=Codex%20OR%20%22OpenAI%20Codex%22%20OR%20%22coding%20agent%22%20OR%20%22AI%20coding%22&restrict_sr=on&sort=comments&t=week' },
  { id: 'Codex_OpenAI', url: 'https://www.reddit.com/r/OpenAI/search.rss?q=Codex%20OR%20%22OpenAI%20Codex%22%20OR%20%22coding%20agent%22%20OR%20%22AI%20coding%22&restrict_sr=on&sort=comments&t=week' },
  { id: 'AI_Coding', url: 'https://www.reddit.com/r/programming/search.rss?q=Codex%20OR%20%22AI%20coding%22%20OR%20%22coding%20agent%22%20OR%20Cursor%20OR%20Claude%20Code&restrict_sr=on&sort=comments&t=week' },
  { id: 'SaaS', url: 'https://www.reddit.com/r/SaaS/search.rss?q=AI%20OR%20agent%20OR%20tool%20OR%20automation&restrict_sr=on&sort=comments&t=day' },
  { id: 'SideProject', url: 'https://www.reddit.com/r/SideProject/search.rss?q=AI%20OR%20agent%20OR%20tool%20OR%20launch&restrict_sr=on&sort=comments&t=day' },
  { id: 'microsaas', url: 'https://www.reddit.com/r/microsaas/search.rss?q=AI%20OR%20agent%20OR%20tool%20OR%20SaaS&restrict_sr=on&sort=comments&t=week' },
  { id: 'AI_Agents', url: 'https://www.reddit.com/r/AI_Agents/search.rss?q=agent%20OR%20workflow%20OR%20tool&restrict_sr=on&sort=comments&t=week' },
  { id: 'GEO_SaaS', url: 'https://www.reddit.com/r/SaaS/search.rss?q=GEO%20OR%20%22generative%20engine%20optimization%22%20OR%20%22AI%20search%22%20OR%20AEO%20OR%20LLMO%20OR%20Perplexity%20OR%20%22ChatGPT%20search%22&restrict_sr=on&sort=comments&t=week' },
  { id: 'GEO_SEO', url: 'https://www.reddit.com/r/SEO/search.rss?q=GEO%20OR%20%22generative%20engine%20optimization%22%20OR%20%22AI%20search%22%20OR%20AEO%20OR%20LLMO%20OR%20Perplexity%20OR%20%22ChatGPT%20search%22&restrict_sr=on&sort=comments&t=week' },
  { id: 'GEO_bigseo', url: 'https://www.reddit.com/r/bigseo/search.rss?q=GEO%20OR%20%22generative%20engine%20optimization%22%20OR%20%22AI%20search%22%20OR%20AEO%20OR%20LLMO%20OR%20Perplexity%20OR%20%22ChatGPT%20search%22&restrict_sr=on&sort=comments&t=week' },
]

const rssSources = [
  { id: 'OpenAI Developers', url: 'https://developers.openai.com/rss.xml', type: 'news' },
  { id: 'Latent Space', url: 'https://www.latent.space/feed', type: 'podcast' },
]

const youtubeChannels = [
  { id: 'Anthropic', url: 'https://www.youtube.com/@anthropic-ai' },
  { id: 'Google DeepMind', url: 'https://www.youtube.com/@googledeepmind' },
  { id: 'Perplexity', url: 'https://www.youtube.com/@perplexityai' },
  { id: 'Y Combinator', url: 'https://www.youtube.com/@ycombinator' },
  { id: 'a16z', url: 'https://www.youtube.com/@a16z' },
  { id: 'Latent Space', url: 'https://www.youtube.com/@LatentSpace' },
  { id: 'No Priors', url: 'https://www.youtube.com/@nopriorspodcast' },
  { id: 'Theo', url: 'https://www.youtube.com/@t3dotgg' },
  { id: 'Fireship', url: 'https://www.youtube.com/@Fireship' },
  { id: 'AI Explained', url: 'https://www.youtube.com/@aiexplained-official' },
  { id: 'Matthew Berman', url: 'https://www.youtube.com/@matthew_berman' },
  { id: 'All-In Podcast', url: 'https://www.youtube.com/@allin' },
]

function keywordScore(text) {
  const normalized = text.toLowerCase()
  const keywords = [
    'codex', 'openai codex', 'chatgpt codex', 'codex cli', 'coding agent',
    'ai coding', 'vibe coding', 'claude code', 'claude ai', 'anthropic',
    'claude desktop', 'claude artifacts', 'cursor', 'devin',
    'windsurf', 'lovable', 'bolt.new', 'replit agent',
    'obsidian', 'pkm', 'knowledge base', 'second brain',
    'creator revenue', 'x payout', 'twitter payout', 'substack revenue',
    'youtube revenue', 'newsletter revenue', 'payout', 'mrr', 'arr',
    'ai', 'agent', 'agents', 'automation', 'workflow', 'tool', 'saas',
    'launch', 'product hunt', 'seo', 'traffic', 'mrr', 'revenue',
    'chrome extension', 'cursor', 'claude', 'chatgpt', 'notebooklm',
    'geo', 'generative engine optimization', 'ai search', 'aeo', 'llmo',
    'perplexity', 'chatgpt search', 'answer engine', 'llm visibility',
  ]
  return keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0)
}

function cleanText(text = '') {
  return decodeEntities(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
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

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return match ? decodeEntities(match[1].replace(/^<!\\[CDATA\\[|\\]\\]>$/g, '').trim()) : ''
}

function classValue(html, className) {
  const match = html.match(new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`))
  return match ? cleanText(match[1]) : ''
}

function articleHref(article) {
  const match = article.match(/<a[^>]+class="title-en"[^>]+href="([^"]+)"/)
    || article.match(/<a[^>]+href="([^"]+)"[^>]*>/)
  return match ? decodeEntities(match[1]) : ''
}

function linkHref(entry) {
  const match = entry.match(/<link[^>]+href="([^"]+)"/)
  return match ? decodeEntities(match[1]) : ''
}

async function fetchText(url) {
  const response = await fetch(url, { headers })
  const text = await response.text()
  return { response, text }
}

async function fetchReddit() {
  const items = []
  const errors = []

  for (const source of redditSources) {
    try {
      const { response, text } = await fetchText(source.url)
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !/(xml|atom|rss)/i.test(contentType)) {
        errors.push({ source: source.id, status: response.status, reason: `non_rss:${contentType}` })
        continue
      }

      const entries = Array.from(text.matchAll(/<entry[\s\S]*?<\/entry>/g)).map((match) => match[0])
      for (const entry of entries) {
        const title = cleanText(tagValue(entry, 'title'))
        const body = cleanText(tagValue(entry, 'content'))
        const url = linkHref(entry)
        const published = tagValue(entry, 'updated') || tagValue(entry, 'published')
        const author = cleanText(tagValue(tagValue(entry, 'author'), 'name'))
        const score = keywordScore(`${title} ${body}`)
        if (score < 2) continue
        items.push({
          source: `Reddit r/${source.id}`,
          type: 'reddit',
          title,
          url,
          external_url: '',
          author,
          published_at: published ? new Date(published).toISOString() : new Date().toISOString(),
          relevance_score: score,
          discussion_status: 'reddit_search_sorted_by_comments',
          summary: body.slice(0, 500),
        })
      }
    } catch (error) {
      errors.push({ source: source.id, reason: String(error) })
    }
  }

  const seen = new Set()
  return {
    items: items
      .filter((item) => {
        if (seen.has(item.url)) return false
        seen.add(item.url)
        return true
      })
      .sort((a, b) => b.relevance_score - a.relevance_score || new Date(b.published_at) - new Date(a.published_at))
      .slice(0, 25),
    errors,
  }
}

async function fetchProductHuntFromOrangeBot() {
  const { response, text } = await fetchText('https://orangebot.ai/sources/product-hunt')
  if (!response.ok) {
    return { items: [], errors: [{ source: 'OrangeBot Product Hunt', status: response.status }] }
  }

  const items = []
  const latestBlock = text.match(/## Latest items([\s\S]*?)## Browse other sources/)
  const block = latestBlock?.[1] || text
  const pattern = /<a[^>]+href="([^"]*producthunt\.com[^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  let match
  while ((match = pattern.exec(block)) && items.length < 30) {
    const url = match[1].replace(/&amp;/g, '&')
    const raw = cleanText(match[2].replace(/<[^>]+>/g, ' '))
    const dateMatch = raw.match(/\b20\d{2}-\d{2}-\d{2}\b/)
    const date = dateMatch?.[0] || new Date().toISOString().slice(0, 10)
    const nameAndTagline = raw.replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '').trim()
    const relevance = keywordScore(nameAndTagline)
    if (relevance < 1) continue
    items.push({
      source: 'Product Hunt via OrangeBot',
      type: 'product_hunt',
      title: nameAndTagline,
      url,
      published_at: `${date}T00:00:00.000Z`,
      relevance_score: relevance,
      summary: nameAndTagline,
    })
  }

  return {
    items,
    errors: items.length ? [] : [{ source: 'OrangeBot Product Hunt', reason: 'no_items_parsed' }],
  }
}

async function fetchRssSources() {
  const items = []
  const errors = []

  for (const source of rssSources) {
    try {
      const { response, text } = await fetchText(source.url)
      if (!response.ok || !/(<rss|<feed|<item|<entry)/i.test(text)) {
        errors.push({ source: source.id, status: response.status, reason: 'non_feed' })
        continue
      }

      const entries = Array.from(text.matchAll(/<entry[\s\S]*?<\/entry>/g)).map((match) => match[0])
      const rssItems = Array.from(text.matchAll(/<item[\s\S]*?<\/item>/g)).map((match) => match[0])
      const sourceItems = []
      for (const entry of [...entries, ...rssItems]) {
        const title = cleanText(tagValue(entry, 'title'))
        const body = cleanText(tagValue(entry, 'summary') || tagValue(entry, 'description') || tagValue(entry, 'content:encoded') || tagValue(entry, 'content'))
        const url = linkHref(entry) || tagValue(entry, 'link') || tagValue(entry, 'guid')
        const published = tagValue(entry, 'updated') || tagValue(entry, 'published') || tagValue(entry, 'pubDate')
        const relevance = keywordScore(`${title} ${body} ${source.id} AI podcast Claude Codex agents`)
        if (!title || (source.type !== 'podcast' && relevance < 1)) continue
        const date = new Date(published)
        sourceItems.push({
          source: source.id,
          type: source.type === 'podcast' ? 'podcast' : 'news',
          title,
          url,
          author: source.id,
          published_at: published && !Number.isNaN(date.valueOf()) ? date.toISOString() : new Date().toISOString(),
          relevance_score: relevance,
          summary: (body || `${source.id} AI podcast episode`).slice(0, 500) || title,
        })
      }
      items.push(...sourceItems.slice(0, 10))
    } catch (error) {
      errors.push({ source: source.id, reason: String(error) })
    }
  }

  if (!items.some((item) => item.source === 'Latent Space')) {
    try {
      const { response, text } = await fetchText('https://www.latent.space/feed')
      if (response.ok) {
        const latentItems = Array.from(text.matchAll(/<item[\s\S]*?<\/item>/g))
          .map((match) => match[0])
          .slice(0, 10)
          .map((entry) => {
            const title = cleanText(entry.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] || tagValue(entry, 'title'))
            const body = cleanText(
              entry.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
              || entry.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1]
              || tagValue(entry, 'description')
            )
            const url = entry.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || tagValue(entry, 'guid')
            const published = entry.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || tagValue(entry, 'pubDate')
            const date = new Date(published)
            return {
              source: 'Latent Space',
              type: 'podcast',
              title,
              url,
              author: cleanText(tagValue(entry, 'dc:creator')) || 'Latent Space',
              published_at: published && !Number.isNaN(date.valueOf()) ? date.toISOString() : new Date().toISOString(),
              relevance_score: keywordScore(`${title} ${body} AI podcast agents Claude Codex`),
              summary: body.slice(0, 500) || title,
            }
          })
          .filter((item) => item.title)
        items.push(...latentItems)
      }
    } catch (error) {
      errors.push({ source: 'Latent Space fallback', reason: String(error) })
    }
  }

  return { items, errors }
}

function youtubeVideoId(entry) {
  return tagValue(entry, 'yt:videoId') || entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1]?.trim() || ''
}

async function resolveYouTubeChannelId(channel) {
  const { response, text } = await fetchText(channel.url)
  if (!response.ok) return { channelId: '', error: { source: channel.id, status: response.status } }
  const channelId = text.match(/"channelId":"(UC[^"]+)"/)?.[1]
    || text.match(/<meta itemprop="channelId" content="(UC[^"]+)"/)?.[1]
    || text.match(/\/channel\/(UC[\w-]+)/)?.[1]
  return channelId
    ? { channelId, error: null }
    : { channelId: '', error: { source: channel.id, reason: 'channel_id_not_found' } }
}

async function fetchYouTubeChannels() {
  const items = []
  const errors = []

  for (const channel of youtubeChannels) {
    try {
      const { channelId, error } = await resolveYouTubeChannelId(channel)
      if (error || !channelId) {
        errors.push(error || { source: channel.id, reason: 'channel_id_not_found' })
        continue
      }
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      const { response, text } = await fetchText(feedUrl)
      if (!response.ok || !text.includes('<feed')) {
        errors.push({ source: channel.id, status: response.status, reason: 'youtube_feed_failed' })
        continue
      }
      const entries = Array.from(text.matchAll(/<entry[\s\S]*?<\/entry>/g)).map((match) => match[0])
      for (const entry of entries.slice(0, 5)) {
        const title = cleanText(tagValue(entry, 'title'))
        const videoId = youtubeVideoId(entry)
        const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : linkHref(entry)
        const published = tagValue(entry, 'published') || tagValue(entry, 'updated')
        const summary = cleanText(tagValue(entry, 'media:description') || tagValue(entry, 'summary') || title)
        const relevance = keywordScore(`${title} ${summary} ${channel.id} youtube video podcast Claude Codex AI`)
        if (!title || relevance < 1) continue
        items.push({
          source: `YouTube ${channel.id}`,
          type: 'youtube',
          title,
          url,
          author: channel.id,
          published_at: published ? new Date(published).toISOString() : new Date().toISOString(),
          relevance_score: relevance,
          summary: summary.slice(0, 500) || title,
        })
      }
    } catch (error) {
      errors.push({ source: channel.id, reason: String(error) })
    }
  }

  return { items, errors }
}

async function fetchProductHuntFromHuntedSpace() {
  const { response, text } = await fetchText('https://hunted.space/')
  if (!response.ok) {
    return { items: [], errors: [{ source: 'Hunted.Space', status: response.status }] }
  }

  const rows = Array.from(text.matchAll(/<a[^>]+href="([^"]+)"[^>]*>\s*(\d+)\s+([^<]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+View Dashboard\s*<\/a>/g))
  const items = rows.slice(0, 20).map((match) => ({
    source: 'Product Hunt via Hunted.Space',
    type: 'product_hunt_rank',
    rank: Number(match[2]),
    title: cleanText(match[3]),
    url: new URL(match[1], 'https://hunted.space/').toString(),
    published_at: new Date().toISOString(),
    upvotes: Number(match[4]),
    comments: Number(match[5]),
    relevance_score: keywordScore(match[3]),
    summary: `Rank ${match[2]} today, ${match[4]} upvotes, ${match[5]} comments.`,
  }))

  return {
    items,
    errors: items.length ? [] : [{ source: 'Hunted.Space', reason: 'no_items_parsed' }],
  }
}

function oneMsIso(dateText, timeText) {
  const now = new Date()
  const year = now.getFullYear()
  const dateMatch = dateText.match(/(\d{2})-(\d{2})/)
  const timeMatch = timeText.match(/(\d{2}):(\d{2})/)
  if (!dateMatch || !timeMatch) return now.toISOString()
  const date = new Date(Date.UTC(
    year,
    Number(dateMatch[1]) - 1,
    Number(dateMatch[2]),
    Number(timeMatch[1]) - 8,
    Number(timeMatch[2]),
  ))
  return date.toISOString()
}

async function fetchOneMsPage({ id, url, type, minScore }) {
  const { response, text } = await fetchText(url)
  if (!response.ok) return { items: [], errors: [{ source: id, status: response.status }] }

  const articles = Array.from(text.matchAll(/<article[\s\S]*?<\/article>/g)).map((match) => match[0])
  const items = []
  for (const article of articles) {
    const title = classValue(article, 'title')
    const summary = classValue(article, 'summary')
    const quote = classValue(article, 'quote')
    const author = classValue(article, 'author')
    const time = classValue(article, 't-time')
    const date = classValue(article, 't-date')
    const href = articleHref(article)
    const relevance = keywordScore(`${title} ${summary} ${quote}`)
    if (!title || !href || relevance < minScore) continue
    items.push({
      source: id === 'yc' ? '1ms.news YC Launch' : '1ms.news HN 72h',
      type,
      title,
      url: href,
      mirror_url: url,
      author,
      published_at: oneMsIso(date, time),
      relevance_score: relevance,
      summary: [summary, quote].filter(Boolean).join(' '),
    })
  }
  return {
    items: items.slice(0, id === 'yc' ? 25 : 20),
    errors: items.length ? [] : [{ source: id, reason: 'no_relevant_items_parsed' }],
  }
}

async function fetchOneMsNews() {
  const [yc, hn] = await Promise.all([
    fetchOneMsPage({ id: 'yc', url: 'https://1ms.news/yc', type: 'one_ms_yc', minScore: 1 }),
    fetchOneMsPage({ id: 'hn', url: 'https://1ms.news/', type: 'one_ms_hn', minScore: 2 }),
  ])
  return {
    items: [...yc.items, ...hn.items],
    errors: [...yc.errors, ...hn.errors],
  }
}

async function main() {
  await fs.mkdir(dataDir, { recursive: true })
  const [reddit, productHunt, huntedSpace, oneMsNews, feeds, youtube] = await Promise.all([
    fetchReddit(),
    fetchProductHuntFromOrangeBot(),
    fetchProductHuntFromHuntedSpace(),
    fetchOneMsNews(),
    fetchRssSources(),
    fetchYouTubeChannels(),
  ])

  const payload = {
    captured_at: new Date().toISOString(),
    sources: {
      reddit,
      product_hunt: {
        items: [...productHunt.items, ...huntedSpace.items],
        errors: [...productHunt.errors, ...huntedSpace.errors],
      },
      one_ms_news: oneMsNews,
      feeds,
      youtube,
    },
  }

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(outputPath)
  console.log(`reddit=${reddit.items.length}, product_hunt=${payload.sources.product_hunt.items.length}, one_ms=${oneMsNews.items.length}, feeds=${feeds.items.length}, youtube=${youtube.items.length}`)
}

await main()

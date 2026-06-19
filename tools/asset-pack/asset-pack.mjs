import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const reportPath = path.join(projectRoot, 'tools/report-builder/data/candidates.json')
const outputDir = path.join(__dirname, 'data')
const publicAssetPackPath = path.join(projectRoot, 'public/asset-pack.json')

const platformSpecs = {
  wechat: {
    label: '公众号',
    skill: 'ljg-writes -> baoyu-post-to-wechat',
    status: 'draft_ready',
  },
  xhs: {
    label: '小红书',
    skill: 'ljg-card / baoyu-xhs-images',
    status: 'draft_ready',
  },
  x: {
    label: 'X/Twitter',
    skill: 'ljg-writes -> baoyu-post-to-x',
    status: 'draft_ready',
  },
  card: {
    label: '知识卡片',
    skill: 'ljg-card',
    status: 'prompt_ready',
  },
  product: {
    label: '工具/MVP',
    skill: 'ljg-rank',
    status: 'brief_ready',
  },
}

function compact(text = '', limit = 260) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function safeSlug(text = '') {
  const slug = text
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'asset'
}

function dateStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('')
}

function sourceLabel(item) {
  if (item.source_type === 'wechat') return item.source
  if (item.source_type === 'x') return item.source
  if (item.source_type === 'reddit') return item.source
  if (item.source_type === 'product_hunt') return 'Product Hunt'
  return item.source || item.source_type
}

function inferCaseType(item) {
  const text = `${item.title} ${item.summary || ''}`.toLowerCase()
  if (/mrr|revenue|\$|收入|月入|访问|traffic|impressions|clicks|users|customers/.test(text)) return 'money_traffic_teardown'
  if (/founder|solo|indie|one-person|一人|个人|创始人/.test(text)) return 'founder_case'
  if (/geo|seo|traffic|visibility|ai search|perplexity|chatgpt search|流量/.test(text)) return 'growth_case'
  if (/agent|workflow|tool|mcp|automation|工具/.test(text)) return 'product_case'
  return 'content_case'
}

function actionValue(item) {
  const tags = item.tags || []
  let score = item.score || 0
  if (tags.includes('商业化案例')) score += 8
  if (tags.includes('可做站')) score += 5
  if (tags.includes('可做工具')) score += 5
  if (tags.includes('GEO')) score += 5
  if (item.source_type === 'x') score += 4
  if (item.source_type === 'wechat') score += 3
  return score
}

function pickItems(report) {
  const pool = [
    ...(report.content_actions || []).map((action) => {
      const base = (report.editorial_candidates || []).find((item) => item.url === action.url) || action
      return { ...base, action }
    }),
    ...(report.editorial_candidates || []),
  ]
  const deduped = []
  const seen = new Set()
  for (const item of pool) {
    const key = item.url || item.id || item.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  const primary = deduped
    .filter((item) => !item.tags?.includes('只观察'))
    .sort((a, b) => actionValue(b) - actionValue(a))[0]

  const xItem = deduped
    .filter((item) => item.source_type === 'x')
    .sort((a, b) => actionValue(b) - actionValue(a))[0]

  const caseItem = deduped
    .filter((item) => item !== primary && /case|mrr|revenue|收入|访问|traffic|users|customers|built|launch|案例/i.test(`${item.title} ${item.summary || ''}`))
    .sort((a, b) => actionValue(b) - actionValue(a))[0]

  return [...new Set([primary, xItem, caseItem].filter(Boolean))].slice(0, 3)
}

function buildWechatArticle(item) {
  const title = `拆一个机会：${item.title}`
  return [
    `# ${title}`,
    '',
    `来源：${sourceLabel(item)}`,
    `原文：${item.url}`,
    `发布时间：${item.published_at || '未知'}`,
    `类型：${inferCaseType(item)}`,
    '',
    '## 先说结论',
    `${compact(item.summary, 180)} 这条信息真正值得看的，不是表面热闹，而是它暴露了一个可以被产品化、内容化或服务化的缺口。`,
    '',
    '## 5W1H 拆解',
    '',
    `**What｜它是什么**：${item.title}`,
    '',
    `**Who｜谁在做/谁在需要**：${sourceLabel(item)} 提供了这个信号；潜在用户是正在找流量、找分发、找 AI 工具机会的独立开发者、出海团队和内容创业者。`,
    '',
    '**Why｜为什么现在重要**：AI 工具和出海独立站的竞争越来越像“信息差 + 执行速度”的比赛。谁能更快把案例拆成页面、工具、文章和分发动作，谁就更容易获得第一波流量。',
    '',
    '**Where｜机会在哪里**：机会不在复述原文，而在把它变成一个可复制模板：案例页、审计工具、选题库、服务包或平台分发内容。',
    '',
    `**When｜什么时候做**：现在适合做 48 小时小验证。先不要做大产品，先写一篇拆解、发一组卡片、做一个落地页或收集 10 个潜在用户反馈。`,
    '',
    '**How｜怎么做**：',
    '1. 把原文里的痛点、数据、动作和结果拆出来。',
    '2. 写成一篇中文案例拆解，标题直接说清楚收益或反差。',
    '3. 压缩成小红书 5-7 张卡片，用“问题 -> 关键数据 -> 方法 -> 可复制步骤 -> 风险”结构。',
    '4. 改成一条 X 长帖，突出海外工具/独立站可复制的部分。',
    '5. 如果信号足够强，再做一个极简 MVP 或 Notion/表单验证。',
    '',
    '## 可复制动作',
    '- 公众号：写成产品/增长案例拆解。',
    '- 小红书：做“一个人/一个站/一个工具怎么赚钱”的图文笔记。',
    '- X：发一条 thread，讲它对 indie hacker 或 AI builder 的启发。',
    '- 工具：如果反复出现同类痛点，做一个 URL 输入 -> 报告输出的小工具。',
    '',
    '## 风险',
    '这条信息仍需要继续验证：原文数据是否可复核，讨论是否真实，是否只是单次噪音。正式发布时要保留来源，不要把推断写成事实。',
    '',
  ].join('\n')
}

function buildXhsNote(item) {
  const title = item.tags?.includes('商业化案例')
    ? `这个出海案例，最值钱的不是产品`
    : `我从一个海外帖子里看到的新机会`
  return [
    `# ${title}`,
    '',
    '## 标题备选',
    `1. ${title}`,
    `2. ${item.title.slice(0, 28)}，到底能不能抄？`,
    '3. 普通人做 AI 出海，应该先看这种小机会',
    '',
    '## 正文',
    `今天看到一个很适合拆的案例：${item.title}`,
    '',
    compact(item.summary, 220),
    '',
    '我觉得它值得看，不是因为它很热，而是因为里面有 3 个可以复用的动作：',
    '',
    '1. 先找一个具体人群的具体问题，不要上来做大平台。',
    '2. 把解决方案包装成一个可检查、可交付、可复用的结果。',
    '3. 用内容和社区先验证需求，再决定要不要做工具。',
    '',
    '如果你也在看 AI 出海机会，可以先问自己：',
    '- 这个需求有没有人已经在公开抱怨？',
    '- 有没有人愿意为了省时间/省钱/多流量付费？',
    '- 能不能先做成一页报告、一篇内容、一个小工具？',
    '',
    '## 标签',
    '#AI出海 #独立开发 #小而美创业 #一人公司 #AI工具 #海外案例 #副业项目',
    '',
    '## 分图脚本',
    '1. 封面：一个海外小案例，藏着 AI 出海机会',
    '2. 这个案例在说什么',
    '3. 真正痛点是什么',
    '4. 可以复制的 3 个动作',
    '5. 适合做成什么产品/内容',
    '6. 48 小时验证清单',
    '',
  ].join('\n')
}

function buildXThread(item) {
  return [
    `1/ ${item.title}`,
    '',
    'This is a useful AI/indie opportunity signal, not just another link.',
    '',
    `Source: ${item.url}`,
    '',
    `2/ The short version: ${compact(item.summary, 240)}`,
    '',
    '3/ The opportunity is not to copy the surface.',
    'The opportunity is to turn the pattern into a repeatable asset:',
    '- a landing page',
    '- a report',
    '- a checklist',
    '- a small tool',
    '- a case study',
    '',
    '4/ My 48-hour validation plan:',
    'Pick one narrow user.',
    'Write one teardown.',
    'Create one simple offer.',
    'Send it to 10 people who already show the pain.',
    '',
    '5/ If people reply with their own URLs, data, or problems, build.',
    'If they only like the post, keep it as content.',
    '',
  ].join('\n')
}

function buildCardPrompt(item) {
  return [
    `标题：${item.title}`,
    '',
    '适合 skill：ljg-card -m 或 baoyu-xhs-images --preset knowledge-card',
    '',
    '卡片结构：',
    '1. 封面：一句反差结论',
    '2. 事实：原文说了什么',
    '3. 痛点：用户为什么需要',
    '4. 机会：可以做成什么',
    '5. 动作：48 小时验证清单',
    '',
    '视觉要求：小红书 1080x1440 多卡；信息密度中等；标题短；每张只讲一个点；保留来源名但不放长链接。',
    '',
    `来源：${sourceLabel(item)} ${item.url}`,
  ].join('\n')
}

function buildMvpBrief(item) {
  return [
    `# MVP Brief：${item.title}`,
    '',
    `来源：${item.url}`,
    '',
    '## 目标用户',
    'AI 出海独立开发者、micro-SaaS 创始人、SEO/GEO 服务商、内容创业者。',
    '',
    '## 问题',
    compact(item.summary, 320),
    '',
    '## 输入',
    '- 一个 URL / 一个案例链接 / 一段用户抱怨',
    '- 目标平台：公众号、小红书、X、网站',
    '',
    '## 输出',
    '- 案例拆解文章',
    '- 小红书分图脚本',
    '- X 长帖',
    '- 可验证的产品假设',
    '',
    '## 48 小时验证',
    '1. 选 10 个类似案例。',
    '2. 每个案例生成一篇拆解和一组卡片。',
    '3. 发布到 2 个平台，记录阅读、收藏、评论、私信。',
    '4. 如果连续 3 条内容出现明确需求，再做工具页。',
    '',
  ].join('\n')
}

function buildAssetForItem(item, index) {
  const slug = `${String(index + 1).padStart(2, '0')}-${safeSlug(item.title)}`
  return {
    id: slug,
    source: {
      title: item.title,
      source: sourceLabel(item),
      source_type: item.source_type,
      url: item.url,
      published_at: item.published_at || '',
      score: item.score || 0,
      tags: item.tags || [],
      summary: item.summary || '',
    },
    case_type: inferCaseType(item),
    priority: index === 0 ? 'high' : 'medium',
    files: {
      wechat_article: `${slug}/wechat-article.md`,
      xhs_note: `${slug}/xiaohongshu-note.md`,
      x_thread: `${slug}/x-thread.md`,
      card_prompt: `${slug}/card-prompt.md`,
      mvp_brief: `${slug}/mvp-brief.md`,
    },
    platform_jobs: [
      { platform: 'wechat', ...platformSpecs.wechat, file: `${slug}/wechat-article.md` },
      { platform: 'xiaohongshu', ...platformSpecs.xhs, file: `${slug}/xiaohongshu-note.md` },
      { platform: 'x', ...platformSpecs.x, file: `${slug}/x-thread.md` },
      { platform: 'card', ...platformSpecs.card, file: `${slug}/card-prompt.md` },
      { platform: 'product', ...platformSpecs.product, file: `${slug}/mvp-brief.md` },
    ],
    preview: {
      wechat_title: `拆一个机会：${item.title}`,
      xhs_title: item.tags?.includes('商业化案例') ? '这个出海案例，最值钱的不是产品' : '我从一个海外帖子里看到的新机会',
      x_hook: item.title,
      card_title: item.title,
    },
    drafts: {
      wechat_article: buildWechatArticle(item),
      xhs_note: buildXhsNote(item),
      x_thread: buildXThread(item),
      card_prompt: buildCardPrompt(item),
      mvp_brief: buildMvpBrief(item),
    },
  }
}

async function writeAssetFiles(baseDir, asset, item) {
  const assetDir = path.join(baseDir, asset.id)
  await fs.mkdir(assetDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(assetDir, 'wechat-article.md'), `${buildWechatArticle(item)}\n`),
    fs.writeFile(path.join(assetDir, 'xiaohongshu-note.md'), `${buildXhsNote(item)}\n`),
    fs.writeFile(path.join(assetDir, 'x-thread.md'), `${buildXThread(item)}\n`),
    fs.writeFile(path.join(assetDir, 'card-prompt.md'), `${buildCardPrompt(item)}\n`),
    fs.writeFile(path.join(assetDir, 'mvp-brief.md'), `${buildMvpBrief(item)}\n`),
    fs.writeFile(path.join(assetDir, 'source.json'), `${JSON.stringify(asset.source, null, 2)}\n`),
  ])
}

async function main() {
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
  const stamp = dateStamp()
  const runDir = path.join(outputDir, stamp)
  await fs.mkdir(runDir, { recursive: true })

  const selected = pickItems(report)
  const assets = selected.map(buildAssetForItem)
  await Promise.all(assets.map((asset, index) => writeAssetFiles(runDir, asset, selected[index])))

  const payload = {
    generated_at: new Date().toISOString(),
    report_generated_at: report.generated_at,
    run_id: stamp,
    output_dir: runDir,
    strategy: 'Pick 1-3 high-action-value candidates and generate publishable drafts for WeChat, Xiaohongshu, X, card prompts, and MVP briefs.',
    counts: {
      assets: assets.length,
      platform_jobs: assets.reduce((sum, asset) => sum + asset.platform_jobs.length, 0),
    },
    multipost: {
      role: 'publishing_executor',
      chrome_web_store_url: 'https://chromewebstore.google.com/detail/multipost/dhohkaclnjgcikfoaacfgijgjgceofih',
      local_extension_dir: path.join(projectRoot, 'tools/multipost-extension/chrome-mv3-prod'),
      status: 'not_verified_in_browser',
    },
    assets,
  }

  await fs.writeFile(path.join(runDir, 'asset-pack.json'), `${JSON.stringify(payload, null, 2)}\n`)
  await fs.writeFile(path.join(outputDir, 'latest.json'), `${JSON.stringify(payload, null, 2)}\n`)
  await fs.writeFile(publicAssetPackPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(path.join(runDir, 'asset-pack.json'))
  console.log(`assets=${payload.counts.assets}, platform_jobs=${payload.counts.platform_jobs}`)
}

await main()

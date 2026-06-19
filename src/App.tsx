import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import ReaderView from './components/ReaderView'

type View = 'wechat' | 'external' | 'assets' | 'geo' | 'skills' | 'brief' | 'reader'

type Skill = {
  id: string
  name: string
  title: string
  category: string
  input: string
  output: string
  bestFor: string
  command: string
}

type Workflow = {
  id: string
  name: string
  intent: string
  steps: string[]
  deliverable: string
}

type Subscription = {
  fakeid: string
  nickname: string
  alias?: string
  article_count: number
  last_poll: number
  rss_url: string
}

type WechatSearchResult = {
  fakeid: string
  nickname: string
  alias?: string
  signature?: string
  head_img?: string
}

type WechatArticle = {
  id: string
  source: string
  title: string
  link: string
  pubDate: string
  author: string
  summary: string
  content: string
  signature?: string
  alias?: string
}

type ReportCandidate = {
  id: string
  source_type: string
  source: string
  tier?: string
  title: string
  url: string
  published_at: string
  summary: string
  score: number
  signals: string[]
  tags: string[]
  recency_hours: number
}

type ReportData = {
  generated_at: string
  mode: string
  source_status: Record<string, string>
  counts: {
    candidates: number
    fresh: number
    editorial: number
  }
  editorial_candidates: ReportCandidate[]
  fresh_candidates: ReportCandidate[]
  candidates: ReportCandidate[]
}

type AssetPack = {
  generated_at: string
  report_generated_at: string
  run_id: string
  output_dir: string
  strategy: string
  counts: {
    assets: number
    platform_jobs: number
  }
  multipost: {
    role: string
    chrome_web_store_url: string
    local_extension_dir: string
    status: string
  }
  assets: AssetItem[]
}

type AssetItem = {
  id: string
  case_type: string
  priority: string
  source: {
    title: string
    source: string
    source_type: string
    url: string
    published_at: string
    score: number
    tags: string[]
    summary: string
  }
  files: Record<string, string>
  platform_jobs: {
    platform: string
    label: string
    skill: string
    status: string
    file: string
  }[]
  preview: {
    wechat_title: string
    xhs_title: string
    x_hook: string
    card_title: string
  }
  drafts: {
    wechat_article: string
    xhs_note: string
    x_thread: string
    card_prompt: string
    mvp_brief: string
  }
}

type GeoInput = {
  brand: string
  website: string
  competitors: string
  keywords: string
  aiAnswers: string
  market: string
}

type GeoReport = {
  ok: boolean
  generated_at: string
  ai_status: string
  input: {
    brand: string
    website: string
    competitors: string[]
    keywords: string[]
    aiAnswers: string
    market: string
  }
  website_audit?: {
    score?: number
    error?: string
    scores?: { name: string; score: number; max: number }[]
    issues?: string[]
    wins?: string[]
    meta?: Record<string, string | number | boolean>
  } | null
  local_signals?: { source: string; title: string; url: string; summary: string; tags: string[]; score: number }[]
  analysis: {
    summary: string
    brand_visibility?: { brand: string; mention_count: number; visibility_level: string; description_accuracy: string }
    competitor_mentions?: { name: string; count: number; note?: string }[]
    citation_sources?: { domain: string; urls?: string[]; type?: string; action?: string }[]
    offsite_placements?: { target: string; why: string; action: string; priority: string }[]
    content_actions?: { action: string; why: string; priority: string }[]
    article_ideas?: string[]
    xhs_cards?: string[]
    seven_day_plan?: string[]
  }
  markdown: string
}

const wechatBaseUrl = 'http://localhost:5010'

const defaultGeoInput: GeoInput = {
  brand: '示例 AI 工具站',
  website: '',
  competitors: 'Jasper\nCopy.ai\nSurfer SEO',
  keywords: 'best AI SEO tools\nAI content optimization tool\nGEO optimization service',
  market: '英文 SaaS / AI 出海',
  aiAnswers: [
    '把 ChatGPT、Perplexity、豆包、千问等回答粘贴到这里。',
    '建议格式：',
    '【ChatGPT】回答正文 + 引用链接',
    '【Perplexity】回答正文 + 引用链接',
    '【豆包】回答正文',
  ].join('\n'),
}

const skills: Skill[] = [
  { id: 'qa', name: 'ljg-qa', title: '问答提取', category: '信息整理', input: '文章、推文、论文、书摘', output: '切中要害的 Q-A', bestFor: '把信息源拆成可复用的推理链', command: '/ljg-qa' },
  { id: 'think', name: 'ljg-think', title: '追本之箭', category: '深度解读', input: '观点、现象、判断', output: '本质分析', bestFor: '解释为什么一个趋势真的成立', command: '/ljg-think' },
  { id: 'rank', name: 'ljg-rank', title: '降秩引擎', category: '赛道判断', input: '领域、赛道、现象集合', output: '支撑领域的生成器', bestFor: '判断 AI 出海机会背后的根本结构', command: '/ljg-rank' },
  { id: 'plain', name: 'ljg-plain', title: '白话说', category: '解释转译', input: '复杂文本、英文资料', output: '可传播中文解释', bestFor: '把高密度信息源转成普通人能懂的话', command: '/ljg-plain' },
  { id: 'writes', name: 'ljg-writes', title: '写作引擎', category: '自媒体内容', input: '观点或机会卡', output: '1000-1500 字长文', bestFor: '公众号、长推、视频口播稿', command: '/ljg-writes' },
  { id: 'card', name: 'ljg-card', title: '铸卡片', category: '视觉内容', input: '文章、提纲、观点', output: 'PNG 卡片', bestFor: '小红书、朋友圈、公众号配图', command: '/ljg-card -m' },
  { id: 'present', name: 'ljg-present', title: '演讲铸造器', category: '演示表达', input: 'Markdown / org outline', output: 'HTML slides', bestFor: '周报、选题会、课程演示', command: '/ljg-present' },
  { id: 'paper-flow', name: 'ljg-paper-flow', title: '论文流', category: '工具链', input: '论文 URL / PDF', output: '解读 + 视觉笔记', bestFor: '读论文并做成分享卡片', command: '/ljg-paper-flow' },
  { id: 'word-flow', name: 'ljg-word-flow', title: '词卡流', category: '工具链', input: '英文单词', output: '词义分析 + 信息图', bestFor: '英文概念卡、词源卡、知识卡', command: '/ljg-word-flow' },
]

const workflows: Workflow[] = [
  { id: 'daily-opportunity', name: '日报精选 -> 机会卡', intent: '从一条信息源判断是否能做 AI 出海小站/工具', steps: ['qa', 'think', 'rank', 'plain'], deliverable: '机会卡：痛点、产品形态、关键词、变现方式、验证动作' },
  { id: 'article-pack', name: '机会卡 -> 公众号长文', intent: '把一个趋势或机会写成可发布长文', steps: ['think', 'writes'], deliverable: '公众号/长推文章' },
  { id: 'xiaohongshu', name: '长文 -> 小红书卡片', intent: '把深度内容压成可转发视觉资产', steps: ['writes', 'card'], deliverable: '小红书多卡片或大字附件图' },
  { id: 'weekly-board', name: '周报 -> 选题会演示', intent: '把一周信息源沉淀成选题会议材料', steps: ['rank', 'present'], deliverable: 'HTML slides' },
  { id: 'paper-card', name: '论文 -> 视觉笔记', intent: '读论文并做成可分享卡片', steps: ['paper-flow'], deliverable: '论文解读 + PNG 视觉笔记' },
  { id: 'word-card', name: '英文概念 -> 词卡', intent: '把英文关键词做成概念信息图', steps: ['word-flow'], deliverable: '词义分析 + PNG 信息图' },
]

const coreSources = [
  { name: '刘小排r', fakeid: 'MzI1MTUxNzgxMA==', focus: 'AI 出海 / AI 工具 / 产品商业化' },
  { name: '哥飞', fakeid: 'MjM5OTIzMzYyMA==', focus: 'AI 工具站 / SEO / 独立站流量' },
  { name: '良辰美', fakeid: 'MzAxMzg0MzMxNg==', focus: 'AI 产品 / 出海 / 商业化案例' },
]

const sourcePresets = [
  '刘小排新文：有了 Coze 3.0，去海边度假真的不用带电脑了。',
  'Product Hunt 今日出现多个 agent workflow 工具：CLI、memory、permission、MCP。',
  'Reddit 讨论：GEO 不是 hack，而是 authority trails、真实引用和社区提及。',
]

function formatDate(seconds?: number) {
  if (!seconds) return '未轮询'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(seconds * 1000))
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/section>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>/gi, '\n![]($1)\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function App() {
  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash.replace('#', '')
    return hash === 'wechat' || hash === 'external' || hash === 'assets' || hash === 'geo' || hash === 'skills' || hash === 'brief' || hash === 'reader'
      ? hash
      : 'reader'
  })
  const [query, setQuery] = useState('')
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(['qa', 'think', 'rank'])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('daily-opportunity')
  const [sourceText, setSourceText] = useState(sourcePresets[0])
  const [outputMode, setOutputMode] = useState('机会卡')
  const [health, setHealth] = useState('检查中')
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [wechatQuery, setWechatQuery] = useState('')
  const [wechatResults, setWechatResults] = useState<WechatSearchResult[]>([])
  const [wechatSearchState, setWechatSearchState] = useState('输入公众号名称后搜索')
  const [wechatActionState, setWechatActionState] = useState('就绪')
  const [wechatArticles, setWechatArticles] = useState<WechatArticle[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportState, setReportState] = useState('未读取')
  const [assetPack, setAssetPack] = useState<AssetPack | null>(null)
  const [assetState, setAssetState] = useState('未读取')
  const [geoInput, setGeoInput] = useState<GeoInput>(defaultGeoInput)
  const [geoReport, setGeoReport] = useState<GeoReport | null>(null)
  const [geoState, setGeoState] = useState('待运行')
  const [geoHealth, setGeoHealth] = useState('检查中')

  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId)
  const selectedSkills = selectedSkillIds
    .map((id) => skills.find((skill) => skill.id === id))
    .filter((skill): skill is Skill => Boolean(skill))

  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return skills
    return skills.filter((skill) =>
      [skill.name, skill.title, skill.category, skill.bestFor, skill.input, skill.output]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
  }, [query])

  const commandPlan = useMemo(() => {
    const steps = selectedSkills
      .map((skill, index) => `${index + 1}. ${skill.command}  # ${skill.title}`)
      .join('\n')
    return `目标：${outputMode}\n素材：${sourceText || '粘贴信息源原文或链接'}\n\n执行链：\n${steps}\n\n输出要求：保留可验证来源，先给结论，再给可执行动作。`
  }, [outputMode, selectedSkills, sourceText])

  async function refreshStatus() {
    try {
      const healthResponse = await fetch(`${wechatBaseUrl}/api/health`)
      const healthData = await healthResponse.json()
      setHealth(healthData.status === 'healthy' ? '运行中' : '异常')
      const subscriptionResponse = await fetch(`${wechatBaseUrl}/api/rss/subscriptions`)
      const subscriptionData = await subscriptionResponse.json()
      setSubscriptions(subscriptionData.data || [])
      await refreshArticles()
      setWechatActionState('已刷新')
    } catch {
      setHealth('浏览器无法读取，请用按钮打开管理页')
      setWechatActionState('状态读取失败，请打开管理后台')
    }
  }

  async function refreshArticles() {
    const response = await fetch(`${wechatBaseUrl}/api/rss/all`)
    const rssText = await response.text()
    const document = new DOMParser().parseFromString(rssText, 'application/xml')
    const items = Array.from(document.querySelectorAll('item'))
    const articles = items.slice(0, 80).map((item, index) => {
      const rawTitle = item.querySelector('title')?.textContent || ''
      const match = rawTitle.match(/^\[(.+?)\]\s*(.+)$/)
      const encoded = item.getElementsByTagName('content:encoded')[0]?.textContent || item.querySelector('description')?.textContent || ''
      const content = htmlToText(encoded)
      const summary = content.replace(/\s+/g, ' ').slice(0, 180)
      return {
        id: `${item.querySelector('link')?.textContent || rawTitle}-${index}`,
        source: match?.[1] || item.querySelector('author')?.textContent || '未知来源',
        title: match?.[2] || rawTitle,
        link: item.querySelector('link')?.textContent || '',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        author: item.querySelector('author')?.textContent || match?.[1] || '',
        summary,
        content,
        signature: encoded.match(/data-signature="([^"]+)"/)?.[1],
        alias: encoded.match(/data-alias="([^"]+)"/)?.[1],
      }
    })
    setWechatArticles(articles)
  }

  async function pollWechat() {
    setHealth('刷新中')
    setWechatActionState('轮询中，公众号多时可能需要几十秒')
    try {
      const response = await fetch(`${wechatBaseUrl}/api/rss/poll`, { method: 'POST' })
      const payload = await response.json().catch(() => null)
      setWechatActionState(payload?.data?.message || '轮询完成，正在同步状态')
      await refreshStatus()
      window.setTimeout(refreshStatus, 2500)
      window.setTimeout(refreshStatus, 8000)
    } catch {
      setHealth('刷新失败，请在管理页手动轮询')
      setWechatActionState('轮询失败，请在管理后台查看日志')
    }
  }

  async function refreshReport() {
    setReportState('读取中')
    try {
      const response = await fetch(`/report-candidates.json?ts=${Date.now()}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setReportData(data)
      setReportState(`已读取 ${new Date(data.generated_at).toLocaleString('zh-CN')}`)
    } catch {
      setReportState('未生成，请先运行 npm run monitor:preview')
    }
  }

  async function refreshAssetPack() {
    setAssetState('读取中')
    try {
      const response = await fetch(`/asset-pack.json?ts=${Date.now()}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setAssetPack(data)
      setAssetState(`已读取 ${new Date(data.generated_at).toLocaleString('zh-CN')}`)
    } catch {
      setAssetState('未生成，请先运行 npm run asset:generate')
    }
  }

  async function refreshGeoHealth() {
    try {
      const response = await fetch('/api/geo/health')
      const payload = await response.json()
      setGeoHealth(payload.deepseek_configured ? `DeepSeek 已配置：${payload.model}` : 'DeepSeek 未配置')
    } catch {
      setGeoHealth('GEO API 未运行')
    }
  }

  async function runGeoAudit() {
    setGeoState('运行中：抓网站、抽引用源、调用 DeepSeek 分析')
    try {
      const response = await fetch('/api/geo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geoInput),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`)
      setGeoReport(payload)
      setGeoState(`已完成：${payload.ai_status}`)
    } catch (error) {
      setGeoState(error instanceof Error ? `失败：${error.message}` : '失败：未知错误')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshStatus()
      refreshReport()
      refreshAssetPack()
      refreshGeoHealth()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyWorkflow(workflow: Workflow) {
    setSelectedWorkflowId(workflow.id)
    setSelectedSkillIds(workflow.steps)
    setOutputMode(workflow.deliverable.split('：')[0])
  }

  function toggleSkill(id: string) {
    setSelectedSkillIds((current) =>
      current.includes(id) ? current.filter((skillId) => skillId !== id) : [...current, id],
    )
  }

  async function copyPlan() {
    await navigator.clipboard.writeText(commandPlan)
  }

  function openView(nextView: View) {
    setView(nextView)
    window.history.replaceState(null, '', `#${nextView}`)
  }

  if (view === 'reader') {
    return <ReaderView onBackToConsole={() => openView('geo')} />
  }

  return (
    <main className="app-shell">
      <aside className="skill-rail">
        <div className="brand">
          <div className="brand-mark">源</div>
          <div>
            <h1>信息源控制台</h1>
            <p>公众号、日报、Skill 工作流</p>
          </div>
        </div>

        <nav className="side-nav">
          <button className={view === 'wechat' ? 'active' : ''} onClick={() => openView('wechat')} type="button">微信公众号</button>
          <button className={view === 'external' ? 'active' : ''} onClick={() => openView('external')} type="button">外部机会源</button>
          <button className={view === 'assets' ? 'active' : ''} onClick={() => openView('assets')} type="button">内容资产</button>
          <button className={view === 'geo' ? 'active' : ''} onClick={() => openView('geo')} type="button">GEO 雷达</button>
          <button className={view === 'skills' ? 'active' : ''} onClick={() => openView('skills')} type="button">Skill 工作台</button>
          <button className={view === 'brief' ? 'active' : ''} onClick={() => openView('brief')} type="button">日报设置</button>
        </nav>

        {view === 'skills' ? (
          <>
            <label className="search-box">
              <span>搜索技能</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="qa / 卡片 / 解读 / 工具链" />
            </label>
            <div className="skill-list">
              {filteredSkills.map((skill) => (
                <button className={`skill-card ${selectedSkillIds.includes(skill.id) ? 'selected' : ''}`} key={skill.id} onClick={() => toggleSkill(skill.id)} type="button">
                  <span className="skill-meta">{skill.category}</span>
                  <strong>{skill.title}</strong>
                  <code>{skill.name}</code>
                  <small>{skill.bestFor}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="help-card">
            <strong>PWA 安装</strong>
            <p>Mac Chrome/Safari 可添加到 Dock；iPhone Safari 可“添加到主屏幕”。安装后只记一个入口。</p>
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <nav>
            <button className={view === 'wechat' ? 'active' : ''} onClick={() => openView('wechat')} type="button">公众号</button>
            <button className={view === 'external' ? 'active' : ''} onClick={() => openView('external')} type="button">外部源</button>
            <button className={view === 'assets' ? 'active' : ''} onClick={() => openView('assets')} type="button">资产</button>
            <button className={view === 'geo' ? 'active' : ''} onClick={() => openView('geo')} type="button">GEO</button>
            <button className={view === 'skills' ? 'active' : ''} onClick={() => openView('skills')} type="button">工作流</button>
            <button className={view === 'brief' ? 'active' : ''} onClick={() => openView('brief')} type="button">日报</button>
          </nav>
          <div className="status">微信：{health}｜GEO：{geoHealth}</div>
        </header>

        {view === 'wechat' && (
          <WechatDashboard
            health={health}
            subscriptions={subscriptions}
            wechatQuery={wechatQuery}
            wechatResults={wechatResults}
            wechatSearchState={wechatSearchState}
            wechatActionState={wechatActionState}
            wechatArticles={wechatArticles}
            setWechatQuery={setWechatQuery}
            setWechatResults={setWechatResults}
            setWechatSearchState={setWechatSearchState}
            setWechatActionState={setWechatActionState}
            onRefresh={refreshStatus}
            onPoll={pollWechat}
          />
        )}

        {view === 'external' && (
          <ExternalDashboard
            reportData={reportData}
            reportState={reportState}
            onRefresh={refreshReport}
          />
        )}

        {view === 'assets' && (
          <AssetPackDashboard
            assetPack={assetPack}
            assetState={assetState}
            onRefresh={refreshAssetPack}
          />
        )}

        {view === 'geo' && (
          <GeoRadarDashboard
            input={geoInput}
            report={geoReport}
            state={geoState}
            health={geoHealth}
            setInput={setGeoInput}
            onRun={runGeoAudit}
            onHealth={refreshGeoHealth}
          />
        )}

        {view === 'skills' && (
          <SkillWorkspace
            sourceText={sourceText}
            setSourceText={setSourceText}
            outputMode={outputMode}
            setOutputMode={setOutputMode}
            selectedWorkflow={selectedWorkflow}
            selectedSkills={selectedSkills}
            selectedWorkflowId={selectedWorkflowId}
            applyWorkflow={applyWorkflow}
          />
        )}

        {view === 'brief' && <BriefSettings />}
      </section>

      <aside className="inspector">
        <div className="section-heading">
          <div>
            <h2>快捷输出</h2>
            <p>管理入口和 Skill 调用计划。</p>
          </div>
        </div>

        <div className="quick-grid">
          <a href={`${wechatBaseUrl}/admin.html`} target="_blank">打开管理页</a>
          <a href={`${wechatBaseUrl}/login.html`} target="_blank">扫码登录</a>
          <a href={`${wechatBaseUrl}/api/rss/all`} target="_blank">聚合 RSS</a>
          <button type="button" onClick={() => openView('geo')}>GEO 雷达</button>
        </div>

        <div className="result-card">
          <span>调用计划</span>
          <pre>{commandPlan}</pre>
          <button className="primary" type="button" onClick={copyPlan}>复制调用计划</button>
        </div>

        <div className="toolchain-card">
          <h3>下一步</h3>
          <p>把日报里的 GEO 候选丢进 GEO 雷达，生成站外占位清单、内容改造动作、文章和卡片选题。</p>
        </div>
      </aside>
    </main>
  )
}

function WechatDashboard({
  health,
  subscriptions,
  wechatQuery,
  wechatResults,
  wechatSearchState,
  wechatActionState,
  wechatArticles,
  setWechatQuery,
  setWechatResults,
  setWechatSearchState,
  setWechatActionState,
  onRefresh,
  onPoll,
}: {
  health: string
  subscriptions: Subscription[]
  wechatQuery: string
  wechatResults: WechatSearchResult[]
  wechatSearchState: string
  wechatActionState: string
  wechatArticles: WechatArticle[]
  setWechatQuery: (value: string) => void
  setWechatResults: (value: WechatSearchResult[]) => void
  setWechatSearchState: (value: string) => void
  setWechatActionState: (value: string) => void
  onRefresh: () => void
  onPoll: () => void
}) {
  const coreFakeIds = new Set(coreSources.map((source) => source.fakeid))
  const extraSubscriptions = subscriptions.filter((subscription) => !coreFakeIds.has(subscription.fakeid))
  const profileBySource = new Map<string, { signature?: string; alias?: string }>()
  wechatArticles.forEach((article) => {
    if (!profileBySource.has(article.source) && (article.signature || article.alias)) {
      profileBySource.set(article.source, { signature: article.signature, alias: article.alias })
    }
  })

  function articleMarkdown(article: WechatArticle) {
    return [
      '---',
      `source: ${article.source}`,
      `title: ${article.title}`,
      `url: ${article.link}`,
      `published: ${article.pubDate}`,
      'tags:',
      '  - 信息源',
      '  - 微信公众号',
      '---',
      '',
      `# ${article.title}`,
      '',
      `来源：${article.source}`,
      `发布时间：${article.pubDate || '未知'}`,
      `原文：${article.link}`,
      '',
      '## 正文',
      article.content || article.summary || '待阅读。',
      '',
    ].join('\n')
  }

  async function copyArticle(article: WechatArticle) {
    await navigator.clipboard.writeText(articleMarkdown(article))
    setWechatActionState(`已复制：${article.title}`)
  }

  function saveToObsidian(article: WechatArticle) {
    const date = new Date().toISOString().slice(0, 10)
    const safeTitle = article.title.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    const params = new URLSearchParams({
      name: `Clippings/${date} ${article.source} ${safeTitle}`,
      content: articleMarkdown(article),
    })
    window.location.href = `obsidian://new?${params.toString()}`
  }

  async function searchWechat() {
    const keyword = wechatQuery.trim()
    if (!keyword) {
      setWechatSearchState('先输入公众号名称')
      return
    }

    setWechatSearchState('搜索中')
    try {
      const response = await fetch(`${wechatBaseUrl}/api/public/searchbiz?query=${encodeURIComponent(keyword)}`)
      const payload = await response.json()
      const results = payload.data?.list || payload.data || []
      setWechatResults(Array.isArray(results) ? results : [])
      setWechatSearchState(Array.isArray(results) && results.length > 0 ? `找到 ${results.length} 个结果` : '没有找到可订阅结果')
    } catch {
      setWechatSearchState('搜索失败，请确认微信服务和登录状态')
    }
  }

  async function subscribeWechat(result: WechatSearchResult) {
    setWechatSearchState(`订阅 ${result.nickname} 中`)
    try {
      await fetch(`${wechatBaseUrl}/api/rss/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fakeid: result.fakeid, nickname: result.nickname }),
      })
      setWechatSearchState(`已订阅 ${result.nickname}，建议点“手动刷新文章”`)
      setWechatActionState(`${result.nickname} 已订阅，尚未抓文章`)
      await onRefresh()
    } catch {
      setWechatSearchState(`订阅 ${result.nickname} 失败，请到管理后台处理`)
    }
  }

  return (
    <>
      <section className="source-panel">
        <div className="section-heading">
          <div>
            <h2>微信公众号主面板</h2>
            <p>这里统一查看、登录、刷新和复制入口。轮询结果以“文章”和“轮询时间”为准。</p>
          </div>
          <div className={`health-pill ${health === '运行中' ? 'ok' : ''}`}>{health}</div>
        </div>
        <div className="action-row">
          <button className="primary compact" type="button" onClick={onPoll}>手动刷新文章</button>
          <button className="secondary compact" type="button" onClick={onRefresh}>检查状态</button>
          <a className="secondary compact" href={`${wechatBaseUrl}/login.html`} target="_blank">重新扫码</a>
          <a className="secondary compact" href={`${wechatBaseUrl}/admin.html`} target="_blank">管理后台</a>
        </div>
        <p className="panel-note">{wechatActionState}</p>
      </section>

      <section className="workflow-panel">
        <div className="section-heading">
          <div>
            <h2>添加公众号</h2>
            <p>输入名称搜索，确认账号后订阅。新增源会进入聚合 RSS，日报可优先读取。</p>
          </div>
          <span className="inline-status">{wechatSearchState}</span>
        </div>
        <div className="subscribe-row">
          <input
            value={wechatQuery}
            onChange={(event) => setWechatQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchWechat()
            }}
            placeholder="例如：刘小排r / 哥飞 / 良辰美"
          />
          <button className="primary compact" type="button" onClick={searchWechat}>搜索公众号</button>
        </div>
        {wechatResults.length > 0 && (
          <div className="search-results">
            {wechatResults.map((result) => {
              const subscribed = subscriptions.some((subscription) => subscription.fakeid === result.fakeid)
              return (
                <article className="search-result" key={result.fakeid}>
                  <div>
                    <strong>{result.nickname}</strong>
                    <p>{result.alias || result.signature || result.fakeid}</p>
                  </div>
                  <button className="secondary compact" disabled={subscribed} type="button" onClick={() => subscribeWechat(result)}>
                    {subscribed ? '已订阅' : '订阅'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="workflow-panel">
        <div className="section-heading">
          <div>
            <h2>S 级公众号</h2>
            <p>理论上可继续添加任意公众号，但建议核心源控制在 20-50 个以内，降低风控和噪音。</p>
          </div>
        </div>
        <div className="source-grid">
          {coreSources.map((source) => {
            const subscription = subscriptions.find((item) => item.fakeid === source.fakeid)
            return (
              <article className="source-card" key={source.fakeid}>
                <span>S 级</span>
                <strong>{source.name}</strong>
                <p>{profileBySource.get(source.name)?.signature || source.focus}</p>
                <dl>
                  <div><dt>文章</dt><dd>{subscription?.article_count ?? '-'}</dd></div>
                  <div><dt>轮询</dt><dd>{formatDate(subscription?.last_poll)}</dd></div>
                </dl>
              </article>
            )
          })}
        </div>
      </section>

      <section className="canvas-panel">
        <div className="section-heading">
          <div>
            <h2>最新文章</h2>
            <p>来自聚合 RSS。这里显示标题、来源、时间、原文链接，并可写入 Obsidian。</p>
          </div>
        </div>
        <div className="article-list">
          {wechatArticles.slice(0, 24).map((article) => (
            <article className="article-row" key={article.id}>
              <div>
                <span>{article.source} · {article.pubDate ? new Date(article.pubDate).toLocaleString('zh-CN') : '未知时间'}</span>
                <strong>{article.title}</strong>
                <p>{article.summary || '暂无摘要'}</p>
              </div>
              <div className="article-actions">
                <a className="secondary compact" href={article.link} target="_blank">原文</a>
                <button className="secondary compact" type="button" onClick={() => copyArticle(article)}>复制</button>
                <button className="primary compact" type="button" onClick={() => saveToObsidian(article)}>Obsidian</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {extraSubscriptions.length > 0 && (
        <section className="workflow-panel">
          <div className="section-heading">
            <div>
              <h2>新增公众号</h2>
              <p>这些源已进入本地 RSS，但还没设为 S 级。适合先观察几天，再决定是否进日报重点源。</p>
            </div>
          </div>
          <div className="source-grid">
            {extraSubscriptions.map((subscription) => (
              <article className="source-card" key={subscription.fakeid}>
                <span>观察</span>
                <strong>{subscription.nickname}</strong>
                <p>{profileBySource.get(subscription.nickname)?.signature || subscription.alias || '暂无公众号简介；先看下方最新文章。'}</p>
                <dl>
                  <div><dt>文章</dt><dd>{subscription.article_count ?? '-'}</dd></div>
                  <div><dt>轮询</dt><dd>{formatDate(subscription.last_poll)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="canvas-panel">
        <div className="section-heading">
          <div>
            <h2>和付费 WeChat RSS 的关系</h2>
            <p>你现在本地这套已经覆盖“搜索公众号、订阅、12 小时轮询、RSS 输出、文章正文抓取”。差别是付费服务帮你托管和维护，我们这里由 Mac mini 自己运行。</p>
          </div>
        </div>
        <div className="compare-grid">
          <div><strong>已具备</strong><p>标准 RSS、核心号订阅、正文解析、本地数据库、12 小时轮询、Docker 常驻。</p></div>
          <div><strong>还缺</strong><p>登录过期提醒、源分级编辑、日报运行日志、远程访问入口。</p></div>
          <div><strong>不建议</strong><p>无限添加公众号。过多会提高风控概率，也会把日报变成噪音池。</p></div>
        </div>
      </section>
    </>
  )
}

function sourceLabel(type: string) {
  if (type === 'wechat') return '公众号'
  if (type === 'x') return 'X'
  if (type === 'product_hunt') return 'Product Hunt'
  if (type === 'reddit') return 'Reddit'
  return type
}

function ExternalDashboard({
  reportData,
  reportState,
  onRefresh,
}: {
  reportData: ReportData | null
  reportState: string
  onRefresh: () => void
}) {
  const sourceEntries = reportData ? Object.entries(reportData.source_status) : []
  const candidates = reportData?.editorial_candidates || []
  const byType = candidates.reduce<Record<string, number>>((acc, item) => {
    acc[item.source_type] = (acc[item.source_type] || 0) + 1
    return acc
  }, {})

  async function copyCandidate(candidate: ReportCandidate) {
    await navigator.clipboard.writeText([
      `# ${candidate.title}`,
      '',
      `来源：${candidate.source} / ${sourceLabel(candidate.source_type)}`,
      `时间：${candidate.published_at || '未知'}`,
      `Score：${candidate.score}`,
      `标签：${candidate.tags.join(', ') || '无'}`,
      `链接：${candidate.url}`,
      '',
      '## 摘要',
      candidate.summary,
    ].join('\n'))
  }

  return (
    <>
      <section className="source-panel">
        <div className="section-heading">
          <div>
            <h2>外部机会源</h2>
            <p>X、Product Hunt、Reddit 和公众号统一打分后的日报候选。</p>
          </div>
          <button className="secondary compact" type="button" onClick={onRefresh}>重新读取</button>
        </div>
        <p className="panel-note">{reportState}</p>
        {reportData && (
          <div className="metric-grid">
            <div><strong>{reportData.counts.candidates}</strong><span>全量候选</span></div>
            <div><strong>{reportData.counts.fresh}</strong><span>新鲜候选</span></div>
            <div><strong>{reportData.counts.editorial}</strong><span>入邮件候选</span></div>
            <div><strong>{Object.keys(byType).length}</strong><span>来源类型</span></div>
          </div>
        )}
      </section>

      <section className="workflow-panel">
        <div className="section-heading">
          <div>
            <h2>抓取状态</h2>
            <p>这里显示最近一次 `monitor:preview` 的结果，不会主动启动抓取。</p>
          </div>
        </div>
        <div className="status-grid">
          {sourceEntries.map(([key, value]) => (
            <article className="status-card" key={key}>
              <span>{sourceLabel(key)}</span>
              <strong>{value}</strong>
            </article>
          ))}
          {!sourceEntries.length && <p className="panel-note">暂无状态。请先运行 `npm run monitor:preview`。</p>}
        </div>
      </section>

      <section className="canvas-panel">
        <div className="section-heading">
          <div>
            <h2>建议进入邮件</h2>
            <p>按 score、标签和来源配额筛选后的 Top 候选。</p>
          </div>
        </div>
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <article className="candidate-row" key={`${candidate.source_type}-${candidate.url}`}>
              <div className="candidate-main">
                <div className="candidate-meta">
                  <span>{sourceLabel(candidate.source_type)}</span>
                  <span>{candidate.source}</span>
                  <span>score {candidate.score}</span>
                  <span>{candidate.published_at ? new Date(candidate.published_at).toLocaleString('zh-CN') : '未知时间'}</span>
                </div>
                <strong>{candidate.title}</strong>
                <p>{candidate.summary}</p>
                <div className="tag-row">
                  {candidate.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  {candidate.signals.slice(0, 6).map((signal) => <span className="muted-tag" key={signal}>{signal}</span>)}
                </div>
              </div>
              <div className="candidate-actions">
                <a className="secondary compact" href={candidate.url} target="_blank">原文</a>
                <button className="secondary compact" type="button" onClick={() => copyCandidate(candidate)}>复制</button>
              </div>
            </article>
          ))}
          {!candidates.length && <p className="panel-note">暂无候选。请先运行 `npm run monitor:preview`。</p>}
        </div>
      </section>
    </>
  )
}

function draftLabel(key: keyof AssetItem['drafts']) {
  if (key === 'wechat_article') return '公众号文章'
  if (key === 'xhs_note') return '小红书笔记'
  if (key === 'x_thread') return 'X 长帖'
  if (key === 'card_prompt') return '卡片生成提示'
  return 'MVP 简版需求'
}

function AssetPackDashboard({
  assetPack,
  assetState,
  onRefresh,
}: {
  assetPack: AssetPack | null
  assetState: string
  onRefresh: () => void
}) {
  async function copyDraft(text: string) {
    await navigator.clipboard.writeText(text)
  }

  return (
    <>
      <section className="source-panel">
        <div className="section-heading">
          <div>
            <h2>内容资产包</h2>
            <p>日报候选会在这里变成公众号文章、小红书笔记、X 长帖、知识卡片提示和 MVP brief。</p>
          </div>
          <button className="secondary compact" type="button" onClick={onRefresh}>重新读取</button>
        </div>
        <p className="panel-note">{assetState}</p>
        {assetPack && (
          <div className="metric-grid">
            <div><strong>{assetPack.counts.assets}</strong><span>资产条目</span></div>
            <div><strong>{assetPack.counts.platform_jobs}</strong><span>平台任务</span></div>
            <div><strong>{assetPack.run_id}</strong><span>批次</span></div>
            <div><strong>{assetPack.multipost.status === 'not_verified_in_browser' ? '待验证' : '已验证'}</strong><span>MultiPost</span></div>
          </div>
        )}
      </section>

      <section className="workflow-panel">
        <div className="section-heading">
          <div>
            <h2>发布执行器</h2>
            <p>MultiPost 负责把已生成内容发到小红书、抖音、微博、知乎、X 等平台；这里先生成和管理草稿。</p>
          </div>
        </div>
        <div className="publish-stack">
          <a className="secondary compact" href="https://chromewebstore.google.com/detail/multipost/dhohkaclnjgcikfoaacfgijgjgceofih" target="_blank">Chrome 安装页</a>
          <a className="secondary compact" href="https://md.multipost.app/" target="_blank">MultiPost 编辑器</a>
          <a className="secondary compact" href="https://docs.multipost.app" target="_blank">官方文档</a>
        </div>
        {assetPack && (
          <p className="panel-note">本地扩展目录：{assetPack.multipost.local_extension_dir}</p>
        )}
      </section>

      <section className="canvas-panel">
        <div className="section-heading">
          <div>
            <h2>待处理资产</h2>
            <p>先人工检查，再用 MultiPost 或对应 skill 发草稿。正式发布前仍要二次确认。</p>
          </div>
        </div>
        <div className="asset-list">
          {(assetPack?.assets || []).map((asset) => (
            <article className="asset-card" key={asset.id}>
              <div className="asset-head">
                <div>
                  <span>{asset.source.source} · score {asset.source.score}</span>
                  <strong>{asset.source.title}</strong>
                  <p>{asset.source.summary}</p>
                </div>
                <a className="secondary compact" href={asset.source.url} target="_blank">原文</a>
              </div>
              <div className="tag-row">
                <span>{asset.case_type}</span>
                <span>{asset.priority}</span>
                {asset.source.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="platform-grid">
                {asset.platform_jobs.map((job) => (
                  <div className="platform-job" key={`${asset.id}-${job.platform}`}>
                    <strong>{job.label}</strong>
                    <span>{job.skill}</span>
                    <small>{job.status}</small>
                  </div>
                ))}
              </div>
              <div className="draft-grid">
                {(Object.entries(asset.drafts) as [keyof AssetItem['drafts'], string][]).map(([key, text]) => (
                  <section className="draft-card" key={key}>
                    <div>
                      <strong>{draftLabel(key)}</strong>
                      <button className="secondary compact" type="button" onClick={() => copyDraft(text)}>复制全文</button>
                    </div>
                    <pre>{text}</pre>
                  </section>
                ))}
              </div>
            </article>
          ))}
          {!assetPack?.assets.length && <p className="panel-note">暂无资产包。请先运行 `npm run asset:generate`。</p>}
        </div>
      </section>
    </>
  )
}

function GeoRadarDashboard({
  input,
  report,
  state,
  health,
  setInput,
  onRun,
  onHealth,
}: {
  input: GeoInput
  report: GeoReport | null
  state: string
  health: string
  setInput: (value: GeoInput) => void
  onRun: () => void
  onHealth: () => void
}) {
  const visibility = report?.analysis.brand_visibility
  const competitorCount = report?.analysis.competitor_mentions?.reduce((sum, item) => sum + Number(item.count || 0), 0) || 0
  const citationCount = report?.analysis.citation_sources?.length || 0
  const actionCount = (report?.analysis.offsite_placements?.length || 0) + (report?.analysis.content_actions?.length || 0)

  function updateField(field: keyof GeoInput, value: string) {
    setInput({ ...input, [field]: value })
  }

  async function copyMarkdown() {
    if (!report) return
    await navigator.clipboard.writeText(report.markdown)
  }

  function saveToObsidian() {
    if (!report) return
    const date = new Date().toISOString().slice(0, 10)
    const safeBrand = (input.brand || 'GEO 引用源雷达').replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim()
    const params = new URLSearchParams({
      name: `Clippings/${date} GEO ${safeBrand}`,
      content: report.markdown,
    })
    window.location.href = `obsidian://new?${params.toString()}`
  }

  return (
    <>
      <section className="source-panel geo-hero">
        <div className="section-heading">
          <div>
            <h2>GEO 引用源雷达</h2>
            <p>输入品牌、竞品、关键词和 AI 回答，输出品牌/竞品出现次数、引用源、站外占位清单、内容改造动作。</p>
          </div>
          <div className={`health-pill ${health.includes('DeepSeek 已配置') ? 'ok' : ''}`}>{health}</div>
        </div>
        <div className="geo-actions">
          <button className="primary compact" type="button" onClick={onRun}>运行 GEO 审计</button>
          <button className="secondary compact" type="button" onClick={onHealth}>检查服务</button>
          <button className="secondary compact" type="button" onClick={() => setInput(defaultGeoInput)}>载入示例</button>
        </div>
        <p className="panel-note">{state}</p>
      </section>

      <section className="geo-layout">
        <div className="workflow-panel geo-form">
          <div className="section-heading">
            <div>
              <h2>输入</h2>
              <p>第一版支持手动粘贴 AI 回答；有官网时会自动做 robots、llms.txt、Schema、内容可引用性体检。</p>
            </div>
          </div>
          <label><span>品牌名</span><input value={input.brand} onChange={(event) => updateField('brand', event.target.value)} placeholder="你的品牌或产品名" /></label>
          <label><span>官网 URL</span><input value={input.website} onChange={(event) => updateField('website', event.target.value)} placeholder="https://example.com，可留空" /></label>
          <label><span>竞品，一行一个</span><textarea value={input.competitors} onChange={(event) => updateField('competitors', event.target.value)} /></label>
          <label><span>关键词/用户问题，一行一个</span><textarea value={input.keywords} onChange={(event) => updateField('keywords', event.target.value)} /></label>
          <label><span>目标市场</span><input value={input.market} onChange={(event) => updateField('market', event.target.value)} placeholder="英文 SaaS / 中国跨境 / 本地服务" /></label>
          <label><span>粘贴 AI 回答和引用链接</span><textarea className="large-textarea" value={input.aiAnswers} onChange={(event) => updateField('aiAnswers', event.target.value)} /></label>
        </div>

        <div className="canvas-panel geo-output">
          <div className="section-heading">
            <div>
              <h2>报告</h2>
              <p>DeepSeek 负责结构化分析；如果 API 临时不可用，会用本地规则兜底输出。</p>
            </div>
            <div className="article-actions geo-copy-actions">
              <button className="secondary compact" type="button" disabled={!report} onClick={copyMarkdown}>复制 MD</button>
              <button className="primary compact" type="button" disabled={!report} onClick={saveToObsidian}>Obsidian</button>
            </div>
          </div>

          {report ? (
            <>
              <div className="metric-grid">
                <div><strong>{visibility?.mention_count ?? 0}</strong><span>品牌出现</span></div>
                <div><strong>{competitorCount}</strong><span>竞品出现</span></div>
                <div><strong>{citationCount}</strong><span>引用源</span></div>
                <div><strong>{actionCount}</strong><span>动作项</span></div>
              </div>

              <div className="geo-summary">
                <h3>核心结论</h3>
                <p>{report.analysis.summary}</p>
              </div>

              <GeoSection title="竞品出现次数">
                {(report.analysis.competitor_mentions || []).map((item) => (
                  <article className="geo-mini-row" key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.count} 次</span>
                    <p>{item.note || '需要结合原始回答核查语境。'}</p>
                  </article>
                ))}
              </GeoSection>

              <GeoSection title="AI 引用源">
                {(report.analysis.citation_sources || []).map((item) => (
                  <article className="geo-mini-row" key={item.domain}>
                    <strong>{item.domain}</strong>
                    <span>{item.type || '网页'}</span>
                    <p>{item.action || '检查是否可提交、评论、外联或写替代内容。'}</p>
                    {(item.urls || []).slice(0, 3).map((url) => <a href={url} target="_blank" key={url}>{url}</a>)}
                  </article>
                ))}
              </GeoSection>

              <GeoSection title="站外占位清单">
                {(report.analysis.offsite_placements || []).map((item) => (
                  <article className="geo-action-row" key={`${item.target}-${item.action}`}>
                    <span>{item.priority}</span>
                    <div><strong>{item.target}</strong><p>{item.action}</p><small>{item.why}</small></div>
                  </article>
                ))}
              </GeoSection>

              <GeoSection title="内容改造动作">
                {(report.analysis.content_actions || []).map((item) => (
                  <article className="geo-action-row" key={`${item.action}-${item.why}`}>
                    <span>{item.priority}</span>
                    <div><strong>{item.action}</strong><p>{item.why}</p></div>
                  </article>
                ))}
              </GeoSection>

              <GeoSection title="可写文章 / 小红书图片笔记">
                <div className="geo-two-col">
                  <div>{(report.analysis.article_ideas || []).map((item) => <p key={item}>• {item}</p>)}</div>
                  <div>{(report.analysis.xhs_cards || []).map((item) => <p key={item}>• {item}</p>)}</div>
                </div>
              </GeoSection>

              <GeoSection title="网站 GEO 体检">
                {report.website_audit?.error ? (
                  <p className="panel-note">{report.website_audit.error}</p>
                ) : report.website_audit ? (
                  <>
                    <div className="geo-score"><strong>{report.website_audit.score}</strong><span>/100</span></div>
                    <div className="status-grid">
                      {(report.website_audit.scores || []).map((item) => (
                        <article className="status-card" key={item.name}>
                          <span>{item.name}</span>
                          <strong>{item.score}/{item.max}</strong>
                        </article>
                      ))}
                    </div>
                    {(report.website_audit.issues || []).length > 0 && (
                      <div className="geo-summary">
                        <h3>优先修复</h3>
                        {(report.website_audit.issues || []).map((issue) => <p key={issue}>• {issue}</p>)}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="panel-note">未填写官网，跳过网站技术体检。</p>
                )}
              </GeoSection>

              <GeoSection title="7 天执行清单">
                <ol className="geo-plan">
                  {(report.analysis.seven_day_plan || []).map((item) => <li key={item}>{item}</li>)}
                </ol>
              </GeoSection>
            </>
          ) : (
            <p className="panel-note">填写左侧内容后运行。最少只填品牌、竞品、关键词、粘贴 AI 回答，也能出报告。</p>
          )}
        </div>
      </section>
    </>
  )
}

function GeoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="geo-section">
      <h3>{title}</h3>
      <div className="geo-section-body">{children}</div>
    </section>
  )
}

function SkillWorkspace({
  sourceText,
  setSourceText,
  outputMode,
  setOutputMode,
  selectedWorkflow,
  selectedSkills,
  selectedWorkflowId,
  applyWorkflow,
}: {
  sourceText: string
  setSourceText: (value: string) => void
  outputMode: string
  setOutputMode: (value: string) => void
  selectedWorkflow: Workflow | undefined
  selectedSkills: Skill[]
  selectedWorkflowId: string
  applyWorkflow: (workflow: Workflow) => void
}) {
  return (
    <>
      <section className="source-panel">
        <div className="section-heading">
          <div>
            <h2>素材</h2>
            <p>粘贴日报条目、推文原文、文章链接或你的想法。</p>
          </div>
          <select value={outputMode} onChange={(event) => setOutputMode(event.target.value)}>
            <option>机会卡</option>
            <option>公众号长文</option>
            <option>小红书卡片</option>
            <option>演示稿</option>
            <option>论文视觉笔记</option>
          </select>
        </div>
        <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} />
        <div className="preset-row">
          {sourcePresets.map((preset) => (
            <button key={preset} type="button" onClick={() => setSourceText(preset)}>{preset.slice(0, 22)}</button>
          ))}
        </div>
      </section>

      <section className="workflow-panel">
        <div className="section-heading"><div><h2>预设工作流</h2><p>选一个模板，或在左侧自由增删 skill。</p></div></div>
        <div className="workflow-grid">
          {workflows.map((workflow) => (
            <button className={`workflow-card ${selectedWorkflowId === workflow.id ? 'selected' : ''}`} key={workflow.id} onClick={() => applyWorkflow(workflow)} type="button">
              <strong>{workflow.name}</strong>
              <span>{workflow.intent}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="canvas-panel">
        <div className="section-heading"><div><h2>组合链路</h2><p>{selectedWorkflow?.deliverable || '自由组合技能。'}</p></div></div>
        <div className="chain">
          {selectedSkills.map((skill, index) => (
            <div className="chain-step" key={skill.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{skill.title}</strong><small>{skill.input} {'->'} {skill.output}</small></div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function BriefSettings() {
  return (
    <section className="source-panel">
      <div className="section-heading">
        <div>
          <h2>日报格式</h2>
          <p>当前已改成机会雷达优先：Gmail 完整版，当前线程极简版。</p>
        </div>
      </div>
      <div className="compare-grid">
        <div><strong>Gmail</strong><p>TL;DR、机会卡、可做站/工具、内容选题、证据链、未抓到。</p></div>
        <div><strong>当前线程</strong><p>3-5 条核心结论、今日机会卡、message id、重点源状态。</p></div>
        <div><strong>下个改造</strong><p>从本地公众号 RSS 优先读取，不再每次临时搜索。</p></div>
      </div>
    </section>
  )
}

export default App

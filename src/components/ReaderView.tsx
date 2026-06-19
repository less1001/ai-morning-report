import { useEffect, useState } from 'react'
import { marked } from 'marked'

interface ReaderViewProps {
  onBackToConsole: () => void
}

interface SidebarCategory {
  displayName: string
  originalTitle: string
}

export default function ReaderView({ onBackToConsole }: ReaderViewProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [briefHtml, setBriefHtml] = useState<string>('')
  const [briefRawMd, setBriefRawMd] = useState<string>('')
  const [sections, setSections] = useState<SidebarCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [copied, setCopied] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('')
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    async function fetchArchiveList() {
      try {
        const res = await fetch('/archive/list.json')
        if (res.ok) {
          const list = await res.json()
          if (Array.isArray(list) && list.length > 0) {
            setDates(list)
            setSelectedDate(list[0])
            return
          }
        }
      } catch (e) {
        console.error('获取归档列表失败', e)
      }
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      setDates([dateStr])
      setSelectedDate(dateStr)
    }
    void fetchArchiveList()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    
    async function fetchBrief() {
      setLoading(true)
      try {
        let res = await fetch(`/archive/brief-${selectedDate}.md`)
        if (!res.ok) {
          res = await fetch('/brief.md')
        }
        if (res.ok) {
          const text = await res.text()
          
          // 将 TL;DR 替换为一分钟速览，更符合中文阅读习惯
          let cleanMd = text.replace(/^##\s+TL;DR/m, '## 一分钟速览')
          
          // 彻底过滤未抓到重点源及下一步资产动作等非读者内容，并清除前置分割线
          const cutIndex = cleanMd.search(/(?:---\s*)?##\s+(?:全量高分候选|全量候选|下一步资产动作|高分候选|未抓到重点源)/)
          if (cutIndex !== -1) {
            cleanMd = cleanMd.substring(0, cutIndex).trim()
          }
          setBriefRawMd(cleanMd)
          
          // 动态提取并智能映射早报核心板块分类
          const mappedCategories: SidebarCategory[] = []
          const lines = cleanMd.split('\n')
          for (const line of lines) {
            if (line.startsWith('## ')) {
              const title = line.replace('## ', '').trim()
              if (title && title !== 'TL;DR' && title !== '今日看点速览' && title !== '摘要' && title !== '一分钟速览' && title !== '今日核心结论速览') {
                let displayName = ''
                if (title.includes('编程') || title.includes('Codex') || title.includes('Claude')) {
                  displayName = 'AI编程'
                } else if (title.includes('赚钱') || title.includes('创作者')) {
                  displayName = '赚钱案例'
                } else if (title.includes('出海机会') || title.includes('工具与')) {
                  displayName = '出海机会'
                } else if (title.includes('今日机会卡') || title.includes('机会卡')) {
                  displayName = '机会卡片'
                } else if (title.includes('新闻') || title.includes('领袖') || title.includes('播客')) {
                  displayName = '行业新闻'
                } else if (title.includes('最值得发的素材') || title.includes('核心素材')) {
                  displayName = '核心素材'
                } else if (title.includes('翻译') || title.includes('改写')) {
                  displayName = '自媒体素材'
                } else if (title.includes('标题')) {
                  displayName = '爆款标题'
                } else if (title.includes('GEO') || title.includes('搜索') || title.includes('SEO')) {
                  displayName = 'GEO优化'
                } else if (title.includes('Reddit') || title.includes('社区') || title.includes('痛点')) {
                  displayName = '社区痛点'
                } else if (title.includes('原文证据')) {
                  displayName = '原文证据'
                }
                
                if (displayName) {
                  if (!mappedCategories.some((c) => c.displayName === displayName)) {
                    mappedCategories.push({
                      displayName,
                      originalTitle: title,
                    })
                  }
                }
              }
            }
          }
          setSections(mappedCategories)
          
          // marked高保真解析Markdown并动态注入锚点id
          const rawHtml = await marked.parse(cleanMd)
          const htmlWithIds = rawHtml.replace(/<h2[^>]*>(.*?)<\/h2>/g, (_, title) => {
            const cleanTitle = title.replace(/<[^>]+>/g, '').trim()
            const cleanId = cleanTitle.replace(/[^\w\u4e00-\u9fa5]/g, '-')
            return `<h2 id="section-${cleanId}">${title}</h2>`
          })
          setBriefHtml(htmlWithIds)
        }
      } catch (e) {
        console.error('加载早报数据失败', e)
      } finally {
        setLoading(false)
      }
    }
    void fetchBrief()
  }, [selectedDate])

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight
      const clientHeight = document.documentElement.clientHeight || window.innerHeight
      const totalHeight = scrollHeight - clientHeight
      if (totalHeight > 0) {
        setScrollProgress((scrollTop / totalHeight) * 100)
      }

      const elements = document.querySelectorAll('.markdown-body h2')
      let currentActiveId = ''
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        const rect = el.getBoundingClientRect()
        if (rect.top <= 120) {
          currentActiveId = el.id
        } else {
          break
        }
      }
      if (currentActiveId) {
        setActiveSection(currentActiveId)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [briefHtml])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.classList.toggle('light-mode', nextTheme === 'light')
  }

  const copyEntireMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(briefRawMd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('复制失败', e)
    }
  }



  const scrollToSection = (originalTitle: string) => {
    const cleanId = originalTitle.replace(/[^\w\u4e00-\u9fa5]/g, '-')
    const targetElement = document.getElementById(`section-${cleanId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="reader-root animate-fade-in">
      {/* 顶部阅读进度条 */}
      <div 
        className="reading-progress-bar" 
        style={{ width: `${scrollProgress}%` }} 
      />

      {/* 顶部导航 */}
      <nav className="reader-nav">
        <div className="nav-logo">
          <h1>AI早报</h1>
        </div>
        <div className="nav-actions">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {theme === 'dark' ? '亮色模式' : '暗黑模式'}
          </button>
          <button onClick={onBackToConsole} className="console-toggle-btn">
            控制台
          </button>
        </div>
      </nav>

      {/* 主体框架 */}
      <div className="reader-grid">
        {/* 左侧侧边栏导航 */}
        <aside className="reader-sidebar">
          {/* 日期归档 */}
          <div className="sidebar-group parchment-panel">
            <div className="sidebar-header">
              <h2>历史归档</h2>
            </div>
            <div className="timeline-list no-scrollbar">
              {dates.map((date) => (
                <button
                  key={date}
                  className={`timeline-item ${selectedDate === date ? 'active' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <div className="timeline-date-text">
                    <span className="date-year">{date.split('-')[0]}</span>
                    <span className="date-day">{date.split('-').slice(1).join('/')}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 分类模块导航 */}
          {sections.length > 0 && (
            <div className="sidebar-group parchment-panel" style={{ marginTop: '24px' }}>
              <div className="sidebar-header">
                <h2>内容分类</h2>
              </div>
              <div className="category-list no-scrollbar">
                {sections.map((sec) => {
                  const cleanId = sec.originalTitle.replace(/[^\w\u4e00-\u9fa5]/g, '-')
                  const targetId = `section-${cleanId}`
                  const isActive = activeSection === targetId
                  return (
                    <button
                      key={sec.displayName}
                      className={`category-item ${isActive ? 'active' : ''}`}
                      onClick={() => scrollToSection(sec.originalTitle)}
                    >
                      {sec.displayName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* 右侧内容阅读区 */}
        <main className="reader-main">
          <div className="reader-actions-bar">
            <button onClick={copyEntireMarkdown} className="copy-md-btn">
              {copied ? '已复制整篇' : '复制整篇Markdown'}
            </button>
          </div>

          {loading ? (
            <div className="reader-loading">
              <p>数据加载中</p>
            </div>
          ) : !briefHtml ? (
            <div className="reader-error parchment-panel" style={{ padding: '40px', textAlign: 'center', margin: '40px 0', border: '1px solid var(--border-light)' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--brand-accent)' }}>未找到早报数据</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                无法加载早报数据，请检查 <code>public/brief.md</code> 是否存在，或在浏览器中执行强刷 (Cmd+Shift+R)。
              </p>
            </div>
          ) : (
            <div className="reader-article-container">
              {/* 高保真文章正文 */}
              <article 
                className="markdown-body animate-fade-in" 
                dangerouslySetInnerHTML={{ __html: briefHtml }} 
              />


              {/* 知识星球推广区域 */}
              <section className="planet-promote parchment-panel">
                <div className="planet-inner">
                  <div className="planet-content">
                    <span className="planet-badge">专属社群</span>
                    <h2>AI出海独立开发知识星球</h2>
                    <p className="planet-desc">
                      每日深度拆解海外最新AI商业案例与出海机会，提供保姆级实操教程与技术支持。
                    </p>
                    <div className="planet-price-box">
                      <span className="price-tag">49元/年</span>
                      <span className="price-desc">限时特惠，微信vkdefi咨询</span>
                    </div>
                    <p className="planet-guide">
                      扫码加入星球后，联系小助理微信：<strong>vkdefi</strong>，即可加入专属微信交流群。
                    </p>
                  </div>
                  <div className="planet-qrcode-wrapper">
                    <img 
                      src="/images/planet_qrcode.png" 
                      alt="知识星球二维码" 
                      className="planet-qrcode-img"
                    />
                    <span className="qrcode-caption">扫码订阅星球</span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* CSS 局部样式定义 */}
      <style>{`
        .reader-root {
          max-width: 1040px;
          margin: 0 auto;
          padding: 40px 24px;
          min-height: 100vh;
        }
        
        .reader-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 0;
          margin-bottom: 40px;
          border-bottom: 1px solid var(--border-light);
        }

        .nav-logo h1 {
          font-size: 24px;
          font-family: 'Georgia', 'Noto Serif SC', serif;
          font-weight: 500;
          color: var(--text-primary);
        }

        .nav-actions {
          display: flex;
          gap: 16px;
        }

        .theme-toggle-btn, .console-toggle-btn {
          background: var(--bg-panel);
          color: var(--text-secondary);
          border: 1px solid var(--border-light);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s ease;
          box-shadow: var(--whisper-shadow);
        }

        .theme-toggle-btn:hover, .console-toggle-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-warm);
          box-shadow: var(--ring-shadow);
        }

        .reader-grid {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 48px;
          align-items: start;
        }

        @media (max-width: 768px) {
          .reader-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .reader-sidebar {
            position: static !important;
            top: 0 !important;
            height: auto !important;
          }
          .sidebar-group {
            padding: 16px !important;
          }
          .timeline-list, .category-list {
            flex-direction: row !important;
            overflow-x: auto !important;
            height: auto !important;
            padding-bottom: 4px;
          }
          .timeline-item, .category-item {
            padding: 4px 12px !important;
            border-bottom: none !important;
            border-right: 1px solid var(--border-light);
            white-space: nowrap;
          }
          .timeline-item:last-child, .category-item:last-child {
            border-right: none;
          }
        }

        /* 侧边栏 */
        .reader-sidebar {
          position: sticky;
          top: 40px;
        }

        .sidebar-group {
          padding: 16px;
        }

        .sidebar-header h2 {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 16px;
          font-family: inherit;
          font-weight: 600;
        }

        .timeline-list {
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          max-height: 200px;
        }

        .timeline-item {
          display: flex;
          align-items: center;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 12px 4px;
          text-align: left;
          transition: all 0.25s ease;
          border-bottom: 1px solid var(--border-light);
        }

        .timeline-item:last-child {
          border-bottom: none;
        }

        .timeline-item:hover {
          color: var(--text-primary);
          text-decoration: underline;
        }

        .timeline-item.active {
          color: var(--brand-accent);
          font-weight: 500;
        }

        .timeline-date-text {
          display: flex;
          flex-direction: column;
        }

        .date-year {
          font-size: 9px;
          opacity: 0.6;
          letter-spacing: 0.05em;
        }

        .date-day {
          font-size: 14px;
          font-family: 'Georgia', serif;
        }

        /* 分类导航 */
        .category-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          max-height: 300px;
        }

        .category-item {
          background: none;
          border: none;
          border-left: 2px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px 0 6px 8px;
          text-align: left;
          font-size: 13.5px;
          transition: all 0.2s ease;
          display: block;
          width: 100%;
          line-height: 1.4;
        }

        .category-item:hover {
          color: var(--text-primary);
          border-left-color: var(--border-warm);
        }

        /* 阅读主面板 */
        .reader-main {
          min-width: 0;
        }

        .reader-actions-bar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px;
        }

        .copy-md-btn {
          background: var(--bg-panel);
          color: var(--text-secondary);
          border: 1px solid var(--border-light);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12.5px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .copy-md-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-warm);
        }

        .reader-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          color: var(--text-muted);
        }

        .reader-article-container {
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        /* 高级出版物印刷排版风格 */
        .markdown-body {
          color: var(--text-secondary);
          line-height: 1.85;
          font-size: 16px;
        }

        .markdown-body h1 {
          font-size: 30px;
          font-family: 'Georgia', 'Noto Serif SC', serif;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 32px;
          line-height: 1.3;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 24px;
        }

        .markdown-body h2 {
          font-size: 20px;
          font-family: 'Georgia', 'Noto Serif SC', serif;
          font-weight: 500;
          color: var(--text-primary);
          margin-top: 48px;
          margin-bottom: 24px;
          line-height: 1.4;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 8px;
          letter-spacing: -0.01em;
          scroll-margin-top: 24px;
        }

        .markdown-body h3 {
          font-size: 16.5px;
          font-family: 'Georgia', 'Noto Serif SC', serif;
          font-weight: 500;
          color: var(--text-primary);
          margin-top: 28px;
          margin-bottom: 12px;
        }

        .markdown-body p {
          margin-bottom: 20px;
        }

        .markdown-body hr {
          border: none;
          border-top: 1px solid var(--border-light);
          margin: 36px 0;
        }

        .markdown-body ul, .markdown-body ol {
          margin-bottom: 20px;
          padding-left: 20px;
        }

        .markdown-body li {
          margin-bottom: 10px;
        }

        .markdown-body li p {
          margin-bottom: 4px;
        }

        .markdown-body strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        .markdown-body blockquote {
          margin: 28px 0;
          padding: 16px 24px;
          background-color: var(--bg-panel);
          border-left: 3px solid var(--brand-accent);
          border-radius: 0 8px 8px 0;
          box-shadow: var(--whisper-shadow);
        }

        .markdown-body blockquote p {
          margin-bottom: 0;
          font-size: 15.5px;
          color: var(--text-secondary);
        }

        .markdown-body a {
          color: var(--brand-accent);
          text-decoration: none;
          border-bottom: 1px dashed var(--brand-accent);
          transition: all 0.2s ease;
        }

        .markdown-body a:hover {
          color: var(--brand-accent-hover);
          border-bottom-style: solid;
        }

        /* 邮件订阅区域 */
        .newsletter-subscribe {
          padding: 36px;
          text-align: center;
          margin-top: 24px;
        }

        .subscribe-inner {
          max-width: 500px;
          margin: 0 auto;
        }

        .newsletter-subscribe h2 {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .newsletter-subscribe p {
          color: var(--text-muted);
          font-size: 14px;
          margin-bottom: 20px;
        }

        .subscribe-form {
          display: flex;
          gap: 10px;
        }

        @media (max-width: 480px) {
          .subscribe-form {
            flex-direction: column;
          }
        }

        .subscribe-form input {
          flex-grow: 1;
          background: var(--bg-main);
          border: 1px solid var(--border-light);
          padding: 10px 14px;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .subscribe-form input:focus {
          outline: none;
          border-color: var(--brand-accent);
        }

        .subscribe-submit-btn {
          background: var(--brand-accent);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 13.5px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          flex-shrink: 0;
        }

        .subscribe-submit-btn:hover {
          background-color: var(--brand-accent-hover);
        }

        /* 页面级滚动进度条 */
        .reading-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          height: 4px;
          background: var(--brand-accent);
          z-index: 9999;
          transition: width 0.1s ease-out;
          box-shadow: 0 1px 10px var(--brand-accent);
        }

        /* 侧边栏高亮样式 */
        .category-item.active {
          color: var(--brand-accent);
          font-weight: 600;
          border-left-color: var(--brand-accent);
        }

        /* 知识星球推广 */
        .planet-promote {
          padding: 36px;
          margin-top: 24px;
        }

        .planet-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }

        @media (max-width: 640px) {
          .planet-inner {
            flex-direction: column;
            text-align: center;
          }
        }

        .planet-content {
          flex: 1;
        }

        .planet-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          color: var(--brand-accent);
          border: 1px solid var(--brand-accent);
          padding: 3px 8px;
          border-radius: 4px;
          margin-bottom: 12px;
          letter-spacing: 0.05em;
        }

        .planet-promote h2 {
          font-size: 22px;
          margin-bottom: 12px;
          color: var(--text-primary);
          font-family: 'Georgia', 'Noto Serif SC', serif;
        }

        .planet-desc {
          color: var(--text-secondary);
          font-size: 14.5px;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .planet-price-box {
          margin-bottom: 16px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        @media (max-width: 640px) {
          .planet-price-box {
            justify-content: center;
          }
        }

        .price-tag {
          font-size: 24px;
          font-weight: 700;
          color: var(--brand-accent);
          font-family: 'Georgia', serif;
        }

        .price-desc {
          font-size: 13px;
          color: var(--text-muted);
        }

        .planet-guide {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .planet-guide strong {
          color: var(--brand-accent);
        }

        .planet-qrcode-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .planet-qrcode-img {
          width: 140px;
          height: 140px;
          border-radius: 8px;
          border: 1px solid var(--border-light);
          padding: 4px;
          background: white;
          box-shadow: var(--whisper-shadow);
          transition: transform 0.3s ease;
        }

        .planet-qrcode-img:hover {
          transform: scale(1.05);
        }

        .qrcode-caption {
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}

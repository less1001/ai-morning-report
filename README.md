# AI Morning Report

AI信息早报网站，用于展示全球AI领域的最新案例、资讯和分析。

## 技术栈
- 前端：React+TypeScript+Vite
- 样式：Vanilla CSS与自定义CSS
- 数据源：静态JSON数据

## 运行与开发
安装依赖：
```bash
npm install
```

启动开发服务器：
```bash
npm run dev
```

构建生产版本：
```bash
npm run build
```

## Cloudflare Pages部署

项目使用静态Vite构建，Pages设置如下：

```text
构建命令：npm run build
构建输出目录：dist
根目录：/
Node.js版本：22
```

仓库中的`.node-version`和`wrangler.toml`已经固定运行时及输出目录。提交到`main`分支后，Pages会自动执行生产部署。

本地发布前验证：

```bash
npm ci
npm run check
```

当前部署是静态前端。微信公众号服务的`localhost:5010`接口和GEO雷达的本地API不会随Pages部署，需要单独迁移到公网HTTPS服务或Cloudflare Workers后才能在公开站点使用。

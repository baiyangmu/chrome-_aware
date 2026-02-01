# Context-Aware AI Assistant

一个 AI 优先的 Chrome 浏览器扩展，利用大语言模型（LLM）深度理解当前页面上下文，智能推荐最相关的操作。

## 核心理念

传统浏览器插件依赖预设的 if-else 规则来判断页面类型和推荐操作。这种方式无法处理未见过的新网站和复杂场景。

本插件采用 **AI 优先架构**：将页面的 URL、DOM 结构、文本内容、用户行为等信息收集并结构化后，交给大模型去理解"用户现在在做什么"以及"什么建议最有帮助"。大模型可以利用训练中学到的世界知识，即使面对全新的网站也能做出合理推断。

当 AI 不可用时，自动降级到规则引擎保证基本可用性。

## 功能特性

- **AI 驱动推荐** — 调用 Anthropic Claude API，基于页面全部上下文生成个性化推荐
- **丰富的上下文采集** — URL、标题、meta 标签、OG 标签、DOM 结构特征、代码块检测、用户行为信号（停留时间、滚动深度、交互强度、文本选中）
- **浏览历史感知** — 跟踪最近 15 个页面访问，识别浏览模式（深度钻研、主题研究、快速浏览）
- **隐私保护** — 发送到 API 前自动过滤信用卡号、身份证号、邮箱、密码、API Key 等敏感信息
- **LRU 智能缓存** — 相似页面复用 AI 分析结果，10 分钟过期，降低 API 调用成本
- **规则引擎降级** — AI 不可用时自动切换到确定性规则引擎
- **15 种内置操作** — 视频摘要、价格追踪、代码解释、文章总结、翻译、事实核查等
- **深色主题侧边栏** — 渐变色设计，置信度进度条，5 维评分详情，流畅动画
- **快捷键** — `Ctrl+Shift+K`（macOS: `Cmd+Shift+K`）一键打开

## 设置 AI 大模型 API Key

本插件使用 Anthropic Claude API 进行 AI 推理。你需要获取一个 API Key 才能启用 AI 功能。

### 第一步：获取 Anthropic API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册或登录你的账号
3. 进入 **API Keys** 页面（左侧导航栏 Settings → API Keys）
4. 点击 **Create Key** 创建新的 API Key
5. 复制生成的 Key（格式类似 `sk-ant-api03-...`）

> **重要**：API Key 只会显示一次，请妥善保存。使用 Claude API 会产生费用，详见 [Anthropic 定价页面](https://www.anthropic.com/pricing)。

### 第二步：在插件中配置 API Key

**方式一：通过弹出窗口（推荐）**

1. 点击浏览器工具栏中的插件图标，打开弹出窗口
2. 在 **API Configuration** 区域，将你的 API Key 粘贴到输入框
3. 点击 **Save** 按钮
4. 顶部状态徽章变为绿色 "AI Ready" 表示配置成功

**方式二：通过侧边栏设置**

1. 按 `Ctrl+Shift+K` 打开侧边栏
2. 点击顶部的齿轮图标（⚙）展开设置面板
3. 在 **Anthropic API Key** 输入框中粘贴 Key
4. 点击 **Save**
5. 标题栏旁的徽章从 "Rules" 变为 "AI" 表示成功

### 第三步：选择模型（可选）

插件支持以下模型，可在弹出窗口或侧边栏设置中切换：

| 模型 | 特点 | 适用场景 |
|------|------|---------|
| Claude Sonnet 4 | 性能与成本平衡 | **默认推荐**，日常使用 |
| Claude Haiku 4 | 响应最快，成本最低 | 追求速度、降低开销 |
| Claude Opus 4 | 最强推理能力 | 复杂分析、深度研究 |

### 未配置 API Key 时

如果没有配置 API Key，插件仍然可以使用：
- 推荐引擎会降级为 **规则模式**（标题栏显示黄色 "Rules" 徽章）
- 基于页面类型和 URL 模式给出预设推荐
- 操作执行会显示占位结果，提示你配置 API Key

### API Key 安全说明

- API Key 存储在浏览器本地（`chrome.storage.local`），**不会上传到任何第三方服务器**
- Key 仅用于直接调用 Anthropic 官方 API（`api.anthropic.com`）
- 发送给 AI 的页面内容经过隐私过滤，敏感信息会被自动移除
- 你可以随时在设置中更换或删除 Key

## 支持的场景和操作

| 页面类型 | 示例网站 | 推荐操作 |
|----------|---------|---------|
| 视频 | YouTube, Vimeo, Bilibili | 视频摘要、查找相关内容、设置提醒 |
| 购物 | Amazon, eBay, 淘宝, 京东 | 价格追踪、全网比价 |
| 代码 | GitHub, GitLab, StackOverflow | 代码解释、优化建议 |
| 新闻 | NYTimes, BBC, CNN | 智能摘要、要点提取、事实核查 |
| 文章 | Medium, Dev.to, Substack | 摘要、要点提取、稍后阅读 |
| 学术 | arXiv, Google Scholar | 深度研究、学习笔记 |
| 社交 | Twitter/X, Reddit, LinkedIn | 情感分析、摘要 |
| 文档 | MDN, ReadTheDocs | 要点提取、学习笔记 |
| 任意 | 所有网站 | 翻译、稍后阅读 |

## 安装

1. 克隆仓库：
   ```bash
   git clone https://github.com/user/context-aware-ai-plugin.git
   ```

2. 打开 Chrome，访问 `chrome://extensions/`

3. 开启右上角的 **开发者模式**

4. 点击 **加载已解压的扩展程序**，选择克隆的目录

5. 工具栏会出现插件图标

## 使用方法

1. **点击工具栏图标** → 打开弹出窗口，配置 API Key，查看使用统计
2. **按 `Ctrl+Shift+K`** → 在任意页面打开 AI 侧边栏
3. 侧边栏自动分析页面上下文，显示 Top 3 推荐操作
4. 点击 **Execute** 执行操作（配置了 API Key 时，AI 会生成真实内容）
5. 点击 **↻** 刷新推荐（选中文本后刷新可获取针对性推荐）

## 文件结构

```
context-aware-ai-plugin/
├── manifest.json      # Chrome Extension Manifest V3 配置
├── background.js      # Service Worker: AI 引擎 + 规则降级 + 操作执行器
├── content.js         # Content Script: 上下文采集 + 侧边栏 UI
├── content.css        # 侧边栏样式：深色主题 + 渐变设计
├── popup.html         # 弹出窗口界面（API Key 配置 + 统计）
├── popup.js           # 弹出窗口逻辑
├── icons/
│   ├── icon16.png     # 工具栏图标 (16x16)
│   ├── icon48.png     # 扩展页图标 (48x48)
│   └── icon128.png    # 商店图标 (128x128)
├── .gitignore
└── README.md
```

## 架构设计

```
┌──────────────────┐          ┌─────────────────────────────────────┐
│   Content Script  │  ◄────►  │       Background Service Worker     │
│                   │          │                                     │
│  ContextAnalyzer  │          │  ┌─────────────┐  ┌──────────────┐ │
│  - URL/Title/Meta │          │  │  AIEngine    │  │ RuleBasedFB  │ │
│  - DOM 结构分析    │          │  │  (Claude API)│  │ (降级引擎)    │ │
│  - 行为信号追踪    │          │  └──────┬──────┘  └──────┬───────┘ │
│  - 内容提取       │          │         │                 │         │
│                   │          │  ┌──────▼─────────────────▼──────┐  │
│  SidebarUI        │          │  │        ContextManager          │  │
│  - 推荐卡片渲染    │          │  │  - 浏览历史 (15 页面队列)       │  │
│  - 设置面板       │          │  │  - 会话感知 + 模式识别          │  │
│  - 结果展示       │          │  │  - 用户行为反馈                 │  │
│                   │          │  └───────────────┬───────────────┘  │
│                   │          │  ┌───────────────▼───────────────┐  │
│                   │          │  │     PrivacyFilter + Cache     │  │
│                   │          │  │  - 敏感信息脱敏                 │  │
│                   │          │  │  - LRU 缓存 (50 条, 10min)    │  │
│                   │          │  └───────────────────────────────┘  │
└──────────────────┘          └─────────────────────────────────────┘
```

### 数据流

1. **ContextAnalyzer**（content.js）分析当前页面，生成丰富的上下文对象（URL、标题、meta、DOM 结构、行为信号）
2. 上下文发送到 **Background Worker**
3. **PrivacyFilter** 过滤敏感信息
4. **CacheLayer** 检查是否有可复用的缓存结果
5. **AIEngine** 构造结构化 Prompt 调用 Claude API（或降级到 **RuleBasedFallback**）
6. AI 返回 3 个推荐，包含置信度、5 维评分、具体推荐理由
7. **SidebarUI** 渲染推荐卡片，用户可执行操作
8. **ActionExecutor** 对 AI 支持的操作再次调用 Claude 生成内容

### AI Prompt 设计

发送给 Claude 的 Prompt 包含以下结构化信息：

- **当前页面**：URL、标题、页面类型、meta 描述/关键词、OG 类型
- **页面结构**：是否有视频/代码块/表单/价格元素、标题数量、预估字数/阅读时间
- **内容摘要**：清洗后的前 1500 字符文本
- **用户选中文本**：如果有选中内容
- **行为信号**：停留时间、滚动深度、交互强度、焦点元素类型
- **浏览历史**：最近 8 个页面的标题、类型、访问时间
- **会话上下文**：浏览模式（深度钻研/主题研究/快速浏览）、会话时长、时间段
- **用户偏好**：历史操作的使用频率和偏好比率

## 扩展新操作

在 `background.js` 中：

1. 在 `PromptBuilder.buildSystemPrompt()` 的操作表中添加新行
2. 在 `AIEngine.callClaude()` 的 `validActionIds` 和 `ACTION_META` 中注册
3. 在 `ActionExecutor` 中添加对应的执行逻辑（AI 或本地）
4. 在 `RuleBasedFallback` 中添加降级策略

## 隐私说明

- 所有数据处理在本地浏览器中完成
- API Key 仅存储在 `chrome.storage.local`
- 发送给 AI 的内容经过隐私过滤（信用卡号、身份证号、邮箱、密码、Token 等自动脱敏）
- 不收集、不上传、不分享任何用户数据到第三方
- 浏览历史仅保留最近 15 条，存储在本地

## 许可证

MIT

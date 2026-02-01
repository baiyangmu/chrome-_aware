# Context-Aware AI Assistant

A Chrome extension that intelligently analyzes the current page context and recommends the most relevant actions using a multi-dimensional scoring model.

## Features

- **Intelligent Recommendation Engine** — Uses a 5-dimension weighted scoring model (not simple rule matching) to rank and suggest the top 3 most relevant actions for the current page.
- **Context Analysis** — Automatically detects page type, extracts content signals, evaluates URL patterns, and considers user behavior history.
- **12 Built-in Actions** — Summarize videos, track prices, explain code, extract key points, translate, and more.
- **Dark Theme Sidebar UI** — Beautiful slide-in sidebar with gradient accents, confidence bars, score breakdowns, and smooth animations.
- **Keyboard Shortcut** — Toggle the sidebar with `Ctrl+Shift+K` (or `Cmd+Shift+K` on macOS).

## Scoring Model

Each action is scored across 5 weighted dimensions (total: 100 points):

| Dimension        | Weight | Description                                       |
|------------------|--------|---------------------------------------------------|
| Page Type Match  | 40     | How well the action fits the detected page type   |
| Scenario Fit     | 30     | Contextual relevance based on content signals      |
| User Behavior    | 15     | Frequency and recency of past usage               |
| URL Feature      | 10     | Domain and URL path pattern matching              |
| Time Factor      | 5      | Time-of-day appropriateness                       |

## Supported Scenarios

| Page Type     | Example Sites                  | Recommended Actions                         |
|---------------|--------------------------------|---------------------------------------------|
| Video         | YouTube, Vimeo, Bilibili       | Summarize Video, Find Related, Set Reminder |
| Shopping      | Amazon, eBay, Walmart          | Track Price, Compare Prices                 |
| Code          | GitHub, GitLab, StackOverflow  | Explain Code, Suggest Optimizations         |
| News/Article  | NYTimes, BBC, Medium           | Smart Summary, Extract Key Points           |
| Any page      | All sites                      | Translate Page, Read Later                  |

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/user/context-aware-ai-plugin.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the cloned directory

5. The extension icon will appear in your toolbar

## Usage

- **Click the extension icon** to open the popup with usage stats
- **Press `Ctrl+Shift+K`** to toggle the AI sidebar on any page
- The sidebar automatically analyzes the page and shows the top 3 recommended actions
- Click **Execute** on any recommendation to run the action
- Click **↻** to refresh recommendations (useful after selecting text)

## File Structure

```
context-aware-ai-plugin/
├── manifest.json      # Chrome Extension Manifest V3 configuration
├── background.js      # Service worker: RecommendationEngine + ActionExecutor
├── content.js         # Content script: ContextAnalyzer + SidebarUI
├── content.css        # Sidebar styles: dark theme with gradient design
├── popup.html         # Extension popup interface
├── popup.js           # Popup logic and usage statistics
├── icons/
│   ├── icon16.png     # Toolbar icon (16x16)
│   ├── icon48.png     # Extension page icon (48x48)
│   └── icon128.png    # Chrome Web Store icon (128x128)
├── .gitignore
└── README.md
```

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│   Content Script │────▶│  Background Worker   │
│                  │◀────│                      │
│ ContextAnalyzer  │     │ RecommendationEngine │
│ SidebarUI        │     │ ActionExecutor       │
└─────────────────┘     └──────────────────────┘
        │
        ▼
┌─────────────────┐
│   Page Context   │
│ - URL & Domain   │
│ - Page Type      │
│ - Content Text   │
│ - Selected Text  │
└─────────────────┘
```

1. **ContextAnalyzer** (content.js) inspects the current page and builds a context object.
2. The context is sent to **RecommendationEngine** (background.js) which scores all actions.
3. Top 3 results are returned with scores, breakdowns, and human-readable reasons.
4. **SidebarUI** (content.js) renders the recommendations in a styled dark-theme panel.
5. When the user clicks Execute, **ActionExecutor** (background.js) processes the action.

## Extending

To add a new action, add an entry to `ACTION_REGISTRY` in `background.js`:

```javascript
{
  id: 'my_action',
  name: 'My Action',
  icon: '🔧',
  description: 'What this action does',
  pageTypes: ['code', 'article'],
  urlPatterns: ['example.com'],
  scenarioTags: ['development', 'learning'],
  timeWeight: { morning: 1.0, afternoon: 1.0, evening: 1.0, night: 1.0 },
  baseRelevance: 0.75
}
```

Then add a corresponding handler in `ActionExecutor.execute()`.

## License

MIT

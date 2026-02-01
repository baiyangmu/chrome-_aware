// ============================================================================
// Context-Aware AI Assistant - Background Service Worker
// Recommendation Engine + Action Executor
// ============================================================================

// ---------------------------------------------------------------------------
// Action Registry - All supported actions with metadata for scoring
// ---------------------------------------------------------------------------
const ACTION_REGISTRY = [
  {
    id: 'summarize_video',
    name: 'Summarize Video',
    icon: '📝',
    description: 'Generate an AI summary of the video content',
    pageTypes: ['video'],
    urlPatterns: ['youtube.com', 'vimeo.com', 'bilibili.com', 'youtu.be'],
    scenarioTags: ['learning', 'entertainment', 'research'],
    timeWeight: { morning: 1.0, afternoon: 1.0, evening: 1.2, night: 1.1 },
    baseRelevance: 0.85
  },
  {
    id: 'find_related',
    name: 'Find Related Content',
    icon: '🔍',
    description: 'Search for related videos, articles, or resources',
    pageTypes: ['video', 'article', 'news'],
    urlPatterns: ['youtube.com', 'vimeo.com', 'medium.com', 'dev.to'],
    scenarioTags: ['research', 'learning', 'exploration'],
    timeWeight: { morning: 1.1, afternoon: 1.0, evening: 0.9, night: 0.8 },
    baseRelevance: 0.70
  },
  {
    id: 'set_reminder',
    name: 'Set Watch Reminder',
    icon: '⏰',
    description: 'Set a reminder to watch or revisit this later',
    pageTypes: ['video', 'article', 'news'],
    urlPatterns: ['youtube.com', 'vimeo.com', 'bilibili.com'],
    scenarioTags: ['productivity', 'planning'],
    timeWeight: { morning: 1.2, afternoon: 1.1, evening: 0.9, night: 0.7 },
    baseRelevance: 0.55
  },
  {
    id: 'track_price',
    name: 'Track Price',
    icon: '💰',
    description: 'Monitor price changes and get alerts on drops',
    pageTypes: ['shopping', 'product'],
    urlPatterns: ['amazon.com', 'ebay.com', 'walmart.com', 'taobao.com', 'jd.com'],
    scenarioTags: ['shopping', 'savings', 'deals'],
    timeWeight: { morning: 1.0, afternoon: 1.1, evening: 1.2, night: 1.0 },
    baseRelevance: 0.90
  },
  {
    id: 'compare_prices',
    name: 'Compare Prices',
    icon: '📊',
    description: 'Search for the same product across multiple stores',
    pageTypes: ['shopping', 'product'],
    urlPatterns: ['amazon.com', 'ebay.com', 'walmart.com', 'bestbuy.com', 'taobao.com'],
    scenarioTags: ['shopping', 'comparison', 'savings'],
    timeWeight: { morning: 1.0, afternoon: 1.1, evening: 1.2, night: 0.9 },
    baseRelevance: 0.80
  },
  {
    id: 'explain_code',
    name: 'Explain Code',
    icon: '💡',
    description: 'Get an AI explanation of the selected or visible code',
    pageTypes: ['code', 'documentation'],
    urlPatterns: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io'],
    scenarioTags: ['development', 'learning', 'debugging'],
    timeWeight: { morning: 1.2, afternoon: 1.1, evening: 1.0, night: 0.9 },
    baseRelevance: 0.88
  },
  {
    id: 'optimize_code',
    name: 'Suggest Optimizations',
    icon: '⚡',
    description: 'Analyze code and suggest performance improvements',
    pageTypes: ['code'],
    urlPatterns: ['github.com', 'gitlab.com', 'codepen.io'],
    scenarioTags: ['development', 'optimization', 'refactoring'],
    timeWeight: { morning: 1.1, afternoon: 1.2, evening: 1.0, night: 0.8 },
    baseRelevance: 0.75
  },
  {
    id: 'smart_summary',
    name: 'Smart Summary',
    icon: '📰',
    description: 'Generate a concise summary of the article',
    pageTypes: ['article', 'news', 'blog'],
    urlPatterns: ['medium.com', 'nytimes.com', 'bbc.com', 'cnn.com', 'reuters.com'],
    scenarioTags: ['reading', 'news', 'research'],
    timeWeight: { morning: 1.3, afternoon: 1.0, evening: 1.1, night: 0.8 },
    baseRelevance: 0.85
  },
  {
    id: 'extract_keypoints',
    name: 'Extract Key Points',
    icon: '🎯',
    description: 'Pull out the main arguments and facts',
    pageTypes: ['article', 'news', 'blog', 'documentation'],
    urlPatterns: ['medium.com', 'nytimes.com', 'bbc.com', 'arxiv.org'],
    scenarioTags: ['research', 'study', 'analysis'],
    timeWeight: { morning: 1.2, afternoon: 1.1, evening: 1.0, night: 0.7 },
    baseRelevance: 0.78
  },
  {
    id: 'translate_page',
    name: 'Translate Page',
    icon: '🌐',
    description: 'Translate the page or selected text to your language',
    pageTypes: ['any'],
    urlPatterns: [],
    scenarioTags: ['language', 'accessibility', 'international'],
    timeWeight: { morning: 1.0, afternoon: 1.0, evening: 1.0, night: 1.0 },
    baseRelevance: 0.50
  },
  {
    id: 'read_later',
    name: 'Read Later',
    icon: '📌',
    description: 'Save this page to your reading list',
    pageTypes: ['any'],
    urlPatterns: [],
    scenarioTags: ['productivity', 'bookmarking', 'reading'],
    timeWeight: { morning: 0.9, afternoon: 1.0, evening: 1.1, night: 1.3 },
    baseRelevance: 0.45
  },
  {
    id: 'analyze_sentiment',
    name: 'Analyze Sentiment',
    icon: '🧠',
    description: 'Detect the overall tone and sentiment of the content',
    pageTypes: ['article', 'news', 'social'],
    urlPatterns: ['twitter.com', 'reddit.com', 'x.com'],
    scenarioTags: ['analysis', 'research', 'social'],
    timeWeight: { morning: 1.0, afternoon: 1.0, evening: 1.1, night: 1.0 },
    baseRelevance: 0.60
  }
];

// ---------------------------------------------------------------------------
// RecommendationEngine - Multi-dimensional scoring model
// ---------------------------------------------------------------------------
class RecommendationEngine {
  constructor() {
    this.actions = ACTION_REGISTRY;
    this.userHistory = {};
    this.loadUserHistory();
  }

  async loadUserHistory() {
    try {
      const data = await chrome.storage.local.get('userHistory');
      this.userHistory = data.userHistory || {};
    } catch {
      this.userHistory = {};
    }
  }

  async saveUserHistory() {
    try {
      await chrome.storage.local.set({ userHistory: this.userHistory });
    } catch {
      // Storage write failed silently
    }
  }

  recordAction(actionId) {
    if (!this.userHistory[actionId]) {
      this.userHistory[actionId] = { count: 0, lastUsed: 0 };
    }
    this.userHistory[actionId].count += 1;
    this.userHistory[actionId].lastUsed = Date.now();
    this.saveUserHistory();
  }

  // --- Main scoring function ---
  calculateRelevanceScore(action, context) {
    const scores = {
      pageTypeMatch: this.scorePageType(action, context),
      scenarioFit: this.scoreScenarioFit(action, context),
      userBehavior: this.scoreUserBehavior(action, context),
      urlFeature: this.scoreUrlFeature(action, context),
      timeFactor: this.scoreTimeFactor(action, context)
    };

    // Weighted sum: pageType(40) + scenario(30) + behavior(15) + url(10) + time(5)
    const total =
      scores.pageTypeMatch * 40 +
      scores.scenarioFit * 30 +
      scores.userBehavior * 15 +
      scores.urlFeature * 10 +
      scores.timeFactor * 5;

    return { total: Math.min(100, Math.max(0, total)), breakdown: scores };
  }

  // Dimension 1: Page Type Match (weight: 40)
  scorePageType(action, context) {
    if (action.pageTypes.includes('any')) return 0.55;

    const pageType = context.pageType || 'unknown';
    if (action.pageTypes.includes(pageType)) return 1.0;

    // Partial matches via semantic proximity map
    const proximity = {
      video: { article: 0.2, news: 0.15, social: 0.25 },
      shopping: { product: 0.9, social: 0.1 },
      code: { documentation: 0.7, article: 0.3 },
      article: { news: 0.8, blog: 0.85, documentation: 0.5 },
      news: { article: 0.8, blog: 0.6, social: 0.4 },
      blog: { article: 0.85, news: 0.5 },
      documentation: { code: 0.6, article: 0.4 },
      social: { news: 0.3, article: 0.2 },
      product: { shopping: 0.9 }
    };

    for (const supportedType of action.pageTypes) {
      const sim = proximity[supportedType]?.[pageType] ?? 0;
      if (sim > 0) return sim;
    }
    return 0.05;
  }

  // Dimension 2: Scenario Fit (weight: 30)
  scoreScenarioFit(action, context) {
    const contextSignals = this.extractScenarioSignals(context);
    if (contextSignals.length === 0) return action.baseRelevance * 0.5;

    let matchScore = 0;
    let matchCount = 0;
    for (const tag of action.scenarioTags) {
      for (const signal of contextSignals) {
        const similarity = this.tagSimilarity(tag, signal);
        if (similarity > 0.3) {
          matchScore += similarity;
          matchCount++;
        }
      }
    }

    if (matchCount === 0) return action.baseRelevance * 0.3;

    const avgMatch = matchScore / Math.max(matchCount, 1);
    const coverage = matchCount / action.scenarioTags.length;
    return Math.min(1.0, avgMatch * 0.6 + coverage * 0.4) * action.baseRelevance;
  }

  extractScenarioSignals(context) {
    const signals = [];
    const text = ((context.title || '') + ' ' + (context.content || '') + ' ' + (context.selectedText || '')).toLowerCase();

    const signalMap = {
      learning: ['tutorial', 'learn', 'course', 'lecture', 'lesson', 'guide', 'how to', 'explained'],
      entertainment: ['funny', 'music', 'movie', 'trailer', 'game', 'clip', 'vlog'],
      research: ['study', 'paper', 'analysis', 'research', 'review', 'survey', 'report'],
      shopping: ['buy', 'price', 'deal', 'sale', 'discount', 'offer', 'cart', 'shipping', 'add to cart'],
      development: ['code', 'function', 'class', 'api', 'bug', 'fix', 'pull request', 'commit', 'repository'],
      reading: ['article', 'story', 'opinion', 'essay', 'blog', 'post'],
      news: ['breaking', 'update', 'latest', 'report', 'announced', 'statement'],
      productivity: ['schedule', 'plan', 'task', 'deadline', 'organize', 'manage'],
      language: ['translation', 'translate', 'foreign', 'language', 'español', 'français', 'deutsch', '中文', '日本語'],
      debugging: ['error', 'bug', 'issue', 'fix', 'stack trace', 'exception', 'debug'],
      optimization: ['performance', 'optimize', 'speed', 'efficiency', 'refactor', 'improve'],
      social: ['comment', 'reply', 'share', 'like', 'follow', 'post', 'thread'],
      analysis: ['data', 'chart', 'statistics', 'trend', 'metric', 'insight'],
      savings: ['coupon', 'cashback', 'save', 'cheap', 'lowest', 'best price'],
      comparison: ['compare', 'vs', 'versus', 'better', 'alternative', 'similar']
    };

    for (const [signal, keywords] of Object.entries(signalMap)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          signals.push(signal);
          break;
        }
      }
    }

    return [...new Set(signals)];
  }

  tagSimilarity(tag, signal) {
    if (tag === signal) return 1.0;

    const similarityMap = {
      learning: { research: 0.7, development: 0.6, reading: 0.5 },
      entertainment: { social: 0.5 },
      research: { learning: 0.7, analysis: 0.8, reading: 0.6 },
      shopping: { savings: 0.85, comparison: 0.8 },
      development: { debugging: 0.8, optimization: 0.7, learning: 0.5 },
      reading: { research: 0.6, news: 0.7, learning: 0.4 },
      news: { reading: 0.7, social: 0.4, analysis: 0.5 },
      productivity: { planning: 0.8 },
      language: { reading: 0.3 },
      debugging: { development: 0.8, optimization: 0.5 },
      optimization: { development: 0.7, debugging: 0.4 },
      social: { entertainment: 0.4, news: 0.3 },
      analysis: { research: 0.8, news: 0.4, comparison: 0.6 },
      savings: { shopping: 0.85, comparison: 0.7 },
      comparison: { shopping: 0.8, savings: 0.7, analysis: 0.5 },
      deals: { shopping: 0.9, savings: 0.9 },
      bookmarking: { productivity: 0.6, reading: 0.5 },
      accessibility: { language: 0.6 },
      international: { language: 0.8 },
      exploration: { research: 0.7, learning: 0.5 },
      refactoring: { optimization: 0.9, development: 0.7 },
      study: { learning: 0.9, research: 0.8 }
    };

    return similarityMap[tag]?.[signal] ?? similarityMap[signal]?.[tag] ?? 0;
  }

  // Dimension 3: User Behavior (weight: 15)
  scoreUserBehavior(action, context) {
    const history = this.userHistory[action.id];
    if (!history) return 0.5; // Neutral for new actions

    const usageFrequency = Math.min(history.count / 20, 1.0);
    const recencyMs = Date.now() - history.lastUsed;
    const recencyDays = recencyMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1.0 - recencyDays / 30);

    // Has selection context? Boost text-related actions
    let selectionBoost = 0;
    if (context.selectedText && context.selectedText.length > 0) {
      const textActions = ['translate_page', 'explain_code', 'smart_summary', 'extract_keypoints'];
      if (textActions.includes(action.id)) {
        selectionBoost = 0.3;
      }
    }

    return Math.min(1.0, usageFrequency * 0.4 + recencyScore * 0.3 + 0.3 + selectionBoost);
  }

  // Dimension 4: URL Feature (weight: 10)
  scoreUrlFeature(action, context) {
    const url = (context.url || '').toLowerCase();
    if (!url) return 0.2;

    // Direct URL pattern match
    for (const pattern of action.urlPatterns) {
      if (url.includes(pattern)) return 1.0;
    }

    // Partial domain heuristics
    const domainHints = {
      video: ['video', 'watch', 'stream', 'tv', 'media'],
      shopping: ['shop', 'store', 'buy', 'product', 'cart', 'checkout'],
      code: ['code', 'repo', 'git', 'dev', 'api', 'docs'],
      article: ['blog', 'post', 'article', 'news', 'story', 'read'],
      social: ['social', 'feed', 'profile', 'tweet', 'status']
    };

    for (const pageType of action.pageTypes) {
      const hints = domainHints[pageType] || [];
      for (const hint of hints) {
        if (url.includes(hint)) return 0.6;
      }
    }

    if (action.pageTypes.includes('any')) return 0.4;
    return 0.1;
  }

  // Dimension 5: Time Factor (weight: 5)
  scoreTimeFactor(action, context) {
    const hour = new Date().getHours();
    let period;
    if (hour >= 6 && hour < 12) period = 'morning';
    else if (hour >= 12 && hour < 18) period = 'afternoon';
    else if (hour >= 18 && hour < 22) period = 'evening';
    else period = 'night';

    const weight = action.timeWeight[period] || 1.0;
    return Math.min(1.0, weight * 0.8);
  }

  // --- Generate Top-3 Recommendations ---
  recommend(context) {
    const scored = this.actions.map(action => {
      const { total, breakdown } = this.calculateRelevanceScore(action, context);
      return {
        ...action,
        score: Math.round(total),
        confidence: Math.round(total),
        breakdown,
        reason: this.generateReason(action, context, breakdown)
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((item, index) => ({
      rank: index + 1,
      id: item.id,
      name: item.name,
      icon: item.icon,
      description: item.description,
      score: item.score,
      confidence: item.confidence,
      reason: item.reason,
      breakdown: item.breakdown
    }));
  }

  generateReason(action, context, breakdown) {
    const parts = [];

    if (breakdown.pageTypeMatch >= 0.8) {
      parts.push(`Detected ${context.pageType || 'matching'} page type`);
    } else if (breakdown.pageTypeMatch >= 0.5) {
      parts.push(`Partially matches ${context.pageType || 'current'} page`);
    }

    if (breakdown.scenarioFit >= 0.6) {
      parts.push('High scenario relevance');
    }

    if (breakdown.urlFeature >= 0.8) {
      const domain = this.extractDomain(context.url);
      parts.push(`Recognized site: ${domain}`);
    }

    if (breakdown.userBehavior >= 0.7) {
      parts.push('Frequently used action');
    }

    if (breakdown.timeFactor >= 0.9) {
      parts.push('Good timing for this action');
    }

    if (context.selectedText && context.selectedText.length > 0) {
      const textActions = ['translate_page', 'explain_code', 'smart_summary', 'extract_keypoints'];
      if (textActions.includes(action.id)) {
        parts.push('Text selection detected');
      }
    }

    return parts.length > 0 ? parts.join(' · ') : 'General recommendation based on context';
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
}

// ---------------------------------------------------------------------------
// ActionExecutor - Execute recommended actions (simulated for now)
// ---------------------------------------------------------------------------
class ActionExecutor {
  async execute(actionId, context) {
    const handlers = {
      summarize_video: () => this.simulateSummarize(context, 'video'),
      find_related: () => this.simulateFindRelated(context),
      set_reminder: () => this.simulateSetReminder(context),
      track_price: () => this.simulateTrackPrice(context),
      compare_prices: () => this.simulateComparePrices(context),
      explain_code: () => this.simulateExplainCode(context),
      optimize_code: () => this.simulateOptimizeCode(context),
      smart_summary: () => this.simulateSummarize(context, 'article'),
      extract_keypoints: () => this.simulateKeypoints(context),
      translate_page: () => this.simulateTranslate(context),
      read_later: () => this.simulateReadLater(context),
      analyze_sentiment: () => this.simulateAnalyzeSentiment(context)
    };

    const handler = handlers[actionId];
    if (!handler) return { success: false, message: 'Unknown action' };

    return handler();
  }

  simulateSummarize(context, type) {
    const title = context.title || 'this content';
    return {
      success: true,
      type: 'summary',
      title: `Summary: ${title}`,
      content: type === 'video'
        ? `📹 **Video Summary**\n\nThis video covers the main topics discussed in "${title}". Key themes include the introduction of core concepts, practical demonstrations, and concluding insights.\n\n*AI-generated summary — full analysis requires API integration.*`
        : `📄 **Article Summary**\n\nThis article "${title}" presents a comprehensive overview of its subject matter. The author discusses multiple perspectives, provides supporting evidence, and draws actionable conclusions.\n\n*AI-generated summary — full analysis requires API integration.*`
    };
  }

  simulateFindRelated(context) {
    return {
      success: true,
      type: 'related',
      title: 'Related Content',
      content: `🔍 **Related to: "${context.title || 'Current Page'}"**\n\n1. Similar content from verified sources\n2. Community discussions and threads\n3. Expert analysis and reviews\n\n*Results would be populated via search API integration.*`
    };
  }

  simulateSetReminder(context) {
    return {
      success: true,
      type: 'reminder',
      title: 'Reminder Set',
      content: `⏰ **Reminder Created**\n\nYou'll be reminded about: "${context.title || 'this page'}"\nScheduled for: Tomorrow at 9:00 AM\n\n*Reminder functionality requires alarm API setup.*`
    };
  }

  simulateTrackPrice(context) {
    return {
      success: true,
      type: 'price_track',
      title: 'Price Tracking Active',
      content: `💰 **Price Tracker Started**\n\nTracking: "${context.title || 'this product'}"\nCurrent URL: ${context.url || 'N/A'}\nAlert threshold: -10% from current price\n\n*Price monitoring requires scheduled background checks.*`
    };
  }

  simulateComparePrices(context) {
    return {
      success: true,
      type: 'comparison',
      title: 'Price Comparison',
      content: `📊 **Price Comparison Results**\n\nProduct: "${context.title || 'Selected Item'}"\n\n| Store | Price | Shipping |\n|-------|-------|----------|\n| Store A | $XX.XX | Free |\n| Store B | $XX.XX | $4.99 |\n| Store C | $XX.XX | Free |\n\n*Real prices require store API integration.*`
    };
  }

  simulateExplainCode(context) {
    const code = context.selectedText || 'the visible code';
    return {
      success: true,
      type: 'explanation',
      title: 'Code Explanation',
      content: `💡 **Code Analysis**\n\n\`\`\`\n${code.substring(0, 200)}${code.length > 200 ? '...' : ''}\n\`\`\`\n\nThis code segment handles its primary logic through structured control flow. Key components include variable declarations, conditional branching, and return statements.\n\n*Detailed AI explanation requires LLM API integration.*`
    };
  }

  simulateOptimizeCode(context) {
    return {
      success: true,
      type: 'optimization',
      title: 'Optimization Suggestions',
      content: `⚡ **Optimization Report**\n\n**Suggestions for: "${context.title || 'Current Code'}"**\n\n1. 🔄 Consider memoization for repeated calculations\n2. 📦 Bundle size could be reduced with tree-shaking\n3. 🚀 Async operations can be parallelized\n\n*Detailed analysis requires code parsing API.*`
    };
  }

  simulateKeypoints(context) {
    return {
      success: true,
      type: 'keypoints',
      title: 'Key Points',
      content: `🎯 **Key Points from: "${context.title || 'Current Article'}"**\n\n• Main thesis and supporting arguments identified\n• Data points and statistics extracted\n• Conclusions and action items highlighted\n\n*Full extraction requires NLP API integration.*`
    };
  }

  simulateTranslate(context) {
    const text = context.selectedText || 'page content';
    return {
      success: true,
      type: 'translation',
      title: 'Translation',
      content: `🌐 **Translation Result**\n\nOriginal: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n\nTranslated text would appear here in your preferred language.\n\n*Translation requires language API integration.*`
    };
  }

  simulateReadLater(context) {
    return {
      success: true,
      type: 'saved',
      title: 'Saved for Later',
      content: `📌 **Saved to Reading List**\n\n"${context.title || 'Current Page'}"\n${context.url || ''}\n\nAdded: ${new Date().toLocaleString()}\n\n*View all saved items in the extension popup.*`
    };
  }

  simulateAnalyzeSentiment(context) {
    return {
      success: true,
      type: 'sentiment',
      title: 'Sentiment Analysis',
      content: `🧠 **Sentiment Report**\n\nContent: "${context.title || 'Current Page'}"\n\nOverall tone: Neutral-Positive\nObjectivity: 72%\nEmotional intensity: Low-Medium\n\n*Detailed sentiment analysis requires NLP API.*`
    };
  }
}

// ---------------------------------------------------------------------------
// Initialize engines
// ---------------------------------------------------------------------------
const engine = new RecommendationEngine();
const executor = new ActionExecutor();

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_RECOMMENDATIONS') {
    const recommendations = engine.recommend(message.context);
    sendResponse({ recommendations });
    return true;
  }

  if (message.type === 'EXECUTE_ACTION') {
    executor.execute(message.actionId, message.context).then(result => {
      engine.recordAction(message.actionId);
      sendResponse(result);
    });
    return true; // async response
  }

  if (message.type === 'GET_STATS') {
    sendResponse({ history: engine.userHistory });
    return true;
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-sidebar') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_SIDEBAR' });
      }
    });
  }
});

// Log initialization
console.log('[Context-Aware AI] Background service worker initialized');

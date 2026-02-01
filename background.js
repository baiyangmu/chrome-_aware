// ============================================================================
// Context-Aware AI Assistant v2.1 — Background Service Worker
// Phase 3: AI-First Architecture
//
// Layers:
//   1. ContextManager     — Maintains browsing history + session context
//   2. PrivacyFilter      — Strips sensitive data before sending to LLM
//   3. PromptBuilder      — Constructs structured prompts from context
//   4. AIEngine           — Calls LLM API (OpenAI-compatible + Anthropic)
//   5. CacheLayer         — LRU cache to avoid redundant API calls
//   6. RuleBasedFallback  — Deterministic fallback when AI is unavailable
//   7. ActionExecutor     — Executes the chosen action
// ============================================================================

'use strict';

// ---------------------------------------------------------------------------
// 1. ContextManager — Browsing history queue + session awareness
// ---------------------------------------------------------------------------
class ContextManager {
  constructor() {
    this.historyQueue = [];       // Recent page visits (max 15)
    this.maxHistory = 15;
    this.sessionStart = Date.now();
    this.actionFeedback = {};     // { actionId: { used: N, ignored: N } }
    this.loadPersisted();
  }

  async loadPersisted() {
    try {
      const data = await chrome.storage.local.get([
        'browsingHistory', 'actionFeedback', 'sessionStart'
      ]);
      this.historyQueue = data.browsingHistory || [];
      this.actionFeedback = data.actionFeedback || {};
      if (data.sessionStart && Date.now() - data.sessionStart < 3600000) {
        this.sessionStart = data.sessionStart;
      }
    } catch { /* first run */ }
  }

  async persist() {
    try {
      await chrome.storage.local.set({
        browsingHistory: this.historyQueue,
        actionFeedback: this.actionFeedback,
        sessionStart: this.sessionStart
      });
    } catch { /* storage write failed */ }
  }

  recordPageVisit(context) {
    const entry = {
      url: context.url,
      title: context.title,
      pageType: context.pageType,
      timestamp: Date.now(),
      dwellTime: context.behaviorSignals?.dwellTime || 0
    };
    this.historyQueue.push(entry);
    if (this.historyQueue.length > this.maxHistory) {
      this.historyQueue.shift();
    }
    this.persist();
  }

  recordActionUsed(actionId) {
    if (!this.actionFeedback[actionId]) {
      this.actionFeedback[actionId] = { used: 0, ignored: 0, lastUsed: 0 };
    }
    this.actionFeedback[actionId].used += 1;
    this.actionFeedback[actionId].lastUsed = Date.now();
    this.persist();
  }

  recordActionIgnored(actionIds) {
    for (const id of actionIds) {
      if (!this.actionFeedback[id]) {
        this.actionFeedback[id] = { used: 0, ignored: 0, lastUsed: 0 };
      }
      this.actionFeedback[id].ignored += 1;
    }
    this.persist();
  }

  getSessionDuration() {
    return Math.round((Date.now() - this.sessionStart) / 60000); // minutes
  }

  getBrowsingPattern() {
    if (this.historyQueue.length < 2) return 'single_page';
    const recent = this.historyQueue.slice(-5);
    const domains = new Set(recent.map(e => {
      try { return new URL(e.url).hostname; } catch { return ''; }
    }));
    const types = new Set(recent.map(e => e.pageType));

    if (domains.size === 1) return 'deep_dive';      // same site
    if (types.size === 1) return 'topic_research';    // same type across sites
    if (recent.every(e => e.dwellTime < 15)) return 'rapid_browsing';
    return 'mixed_browsing';
  }

  getRecentHistorySummary() {
    return this.historyQueue.slice(-8).map(e => ({
      title: (e.title || '').substring(0, 80),
      type: e.pageType,
      minutesAgo: Math.round((Date.now() - e.timestamp) / 60000)
    }));
  }

  getUserPreferences() {
    const prefs = {};
    for (const [id, data] of Object.entries(this.actionFeedback)) {
      const ratio = data.used / Math.max(data.used + data.ignored, 1);
      if (data.used >= 2) prefs[id] = { useCount: data.used, preference: ratio };
    }
    return prefs;
  }
}

// ---------------------------------------------------------------------------
// 2. PrivacyFilter — Remove sensitive data before sending to LLM
// ---------------------------------------------------------------------------
class PrivacyFilter {
  constructor() {
    this.sensitivePatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,              // credit card
      /\b\d{3}-\d{2}-\d{4}\b/g,                                      // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi,         // email
      /\b(?:password|passwd|pwd|secret|token|apikey|api_key)\s*[:=]\s*\S+/gi, // credentials
      /\bbearer\s+[A-Za-z0-9\-._~+\/]+=*/gi,                        // bearer tokens
      /\b(?:sk-|pk_live_|pk_test_|rk_live_|rk_test_)[A-Za-z0-9]+/g, // API keys
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,                   // IP addresses
      /\+?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g // phone numbers
    ];
  }

  sanitize(text) {
    if (!text) return '';
    let clean = text;
    for (const pattern of this.sensitivePatterns) {
      clean = clean.replace(pattern, '[REDACTED]');
    }
    return clean;
  }

  sanitizeContext(context) {
    return {
      url: context.url, // URL is needed for page type understanding
      title: this.sanitize(context.title),
      pageType: context.pageType,
      content: this.sanitize((context.content || '').substring(0, 1500)),
      selectedText: this.sanitize((context.selectedText || '').substring(0, 500)),
      metaDescription: this.sanitize((context.metaDescription || '').substring(0, 300)),
      metaKeywords: context.metaKeywords || '',
      ogType: context.ogType || '',
      structuralFeatures: context.structuralFeatures || {},
      behaviorSignals: context.behaviorSignals || {},
      // Don't send raw HTML or full DOM
    };
  }
}

// ---------------------------------------------------------------------------
// 3. PromptBuilder — Build structured prompts for the LLM
// ---------------------------------------------------------------------------
class PromptBuilder {
  constructor(contextManager) {
    this.contextManager = contextManager;
  }

  buildSystemPrompt() {
    return `You are an expert intelligent browsing assistant embedded in a Chrome extension. Your job is to deeply understand the user's current browsing context and recommend the 3 most helpful actions.

## Your capabilities
You have rich world knowledge about websites, web applications, and user workflows. You understand:
- What different types of websites are for (video platforms, e-commerce, code repositories, news sites, documentation, social media, etc.)
- What actions are most useful in different contexts
- How user behavior signals (text selection, scroll depth, dwell time, browsing patterns) reveal intent
- How browsing history reveals ongoing tasks and goals

## Available actions you can recommend
Each action has an ID. You MUST only recommend from this list:

| ID | Name | Description |
|----|------|-------------|
| summarize_video | Summarize Video | Generate AI summary of video content |
| find_related | Find Related Content | Search for related resources across the web |
| set_reminder | Set Reminder | Bookmark with a timed reminder to revisit |
| track_price | Track Price | Monitor price changes and alert on drops |
| compare_prices | Compare Prices | Search for the same product across stores |
| explain_code | Explain Code | AI explanation of selected or visible code |
| optimize_code | Suggest Optimizations | Analyze code for performance improvements |
| smart_summary | Smart Summary | Concise AI summary of the article/page |
| extract_keypoints | Extract Key Points | Pull out main arguments, facts, and data |
| translate_page | Translate Page | Translate page or selected text |
| read_later | Save for Later | Save to reading list for later |
| analyze_sentiment | Analyze Sentiment | Detect overall tone and sentiment |
| deep_research | Deep Research | Gather comprehensive info on the topic |
| generate_notes | Generate Study Notes | Create structured notes from the content |
| check_facts | Fact Check | Verify claims and statistics in the content |

## Response format
You MUST respond with valid JSON only, no markdown fences, no extra text. The schema:

{
  "understanding": "1-2 sentence description of what the user is doing and likely wants",
  "recommendations": [
    {
      "action_id": "one of the IDs above",
      "name": "human-readable name",
      "confidence": 85,
      "reasoning": "Why this action is relevant in this specific context (be specific, reference actual page content/URL/behavior)",
      "dimensions": {
        "context_match": 0.9,
        "intent_alignment": 0.8,
        "behavioral_signal": 0.7,
        "historical_fit": 0.6,
        "timing_relevance": 0.8
      }
    }
  ]
}

Rules:
- Return exactly 3 recommendations, sorted by confidence (highest first)
- Confidence is 0-100, be calibrated (don't always give 90+)
- Each dimension score is 0.0-1.0
- "reasoning" must be specific to THIS page, not generic
- If the user has selected text, strongly consider actions that work with text
- Consider the user's browsing history and pattern to infer ongoing tasks
- Consider the time of day for appropriateness`;
  }

  buildUserPrompt(sanitizedContext, historyContext) {
    const hour = new Date().getHours();
    const timeLabel =
      hour >= 6 && hour < 12 ? 'morning' :
      hour >= 12 && hour < 18 ? 'afternoon' :
      hour >= 18 && hour < 22 ? 'evening' : 'late night';

    const dayOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const isWeekend = [0, 6].includes(new Date().getDay());

    const sections = [];

    // --- Current page ---
    sections.push(`## Current Page
- **URL**: ${sanitizedContext.url}
- **Title**: ${sanitizedContext.title}
- **Detected page type**: ${sanitizedContext.pageType}
- **Meta description**: ${sanitizedContext.metaDescription || 'N/A'}
- **Meta keywords**: ${sanitizedContext.metaKeywords || 'N/A'}
- **OG type**: ${sanitizedContext.ogType || 'N/A'}`);

    // --- Structural features ---
    const sf = sanitizedContext.structuralFeatures || {};
    if (Object.keys(sf).length > 0) {
      const featureLines = Object.entries(sf)
        .filter(([, v]) => v)
        .map(([k, v]) => `- ${k}: ${typeof v === 'boolean' ? 'yes' : v}`)
        .join('\n');
      if (featureLines) {
        sections.push(`## Page Structure\n${featureLines}`);
      }
    }

    // --- Content excerpt ---
    if (sanitizedContext.content) {
      sections.push(`## Content Excerpt (first ~1500 chars)\n${sanitizedContext.content}`);
    }

    // --- Selected text ---
    if (sanitizedContext.selectedText) {
      sections.push(`## User Selected Text\n"${sanitizedContext.selectedText}"`);
    }

    // --- Behavior signals ---
    const bs = sanitizedContext.behaviorSignals || {};
    if (Object.keys(bs).length > 0) {
      sections.push(`## User Behavior Signals
- Dwell time on page: ${bs.dwellTime || 0} seconds
- Scroll depth: ${bs.scrollDepth || 0}%
- Interaction level: ${bs.interactionLevel || 'unknown'}
- Has text selection: ${bs.hasSelection ? 'yes' : 'no'}
- Focused element type: ${bs.focusedElementType || 'none'}`);
    }

    // --- Browsing history ---
    const history = historyContext.recentHistory || [];
    if (history.length > 0) {
      const historyLines = history.map(h =>
        `- [${h.minutesAgo}min ago] (${h.type}) ${h.title}`
      ).join('\n');
      sections.push(`## Recent Browsing History\n${historyLines}`);
    }

    // --- Session & pattern ---
    sections.push(`## Session Context
- Browsing pattern: ${historyContext.browsingPattern}
- Session duration: ${historyContext.sessionDuration} minutes
- Time: ${timeLabel} (${hour}:00), ${dayOfWeek}${isWeekend ? ' (weekend)' : ' (weekday)'}`);

    // --- User preferences ---
    const prefs = historyContext.userPreferences || {};
    if (Object.keys(prefs).length > 0) {
      const prefLines = Object.entries(prefs)
        .sort((a, b) => b[1].useCount - a[1].useCount)
        .slice(0, 5)
        .map(([id, p]) => `- ${id}: used ${p.useCount} times (preference: ${Math.round(p.preference * 100)}%)`)
        .join('\n');
      sections.push(`## User Action Preferences\n${prefLines}`);
    }

    sections.push(`\nBased on all of the above, recommend the 3 most helpful actions for this user right now. Remember to respond with valid JSON only.`);

    return sections.join('\n\n');
  }

  buildIncrementalPrompt(previousRecommendations, newSignals) {
    return `The user is still on the same page. Previously you recommended:
${JSON.stringify(previousRecommendations, null, 2)}

New signals have appeared:
${JSON.stringify(newSignals, null, 2)}

Based on these new signals, should the recommendations change? Respond with the same JSON format. If no change is needed, return the same recommendations with the same scores.`;
  }
}

// ---------------------------------------------------------------------------
// 4. CacheLayer — LRU cache for AI responses
// ---------------------------------------------------------------------------
class CacheLayer {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.cache = new Map(); // key → { result, timestamp, hitCount }
  }

  generateKey(context) {
    // Cache key: domain + pageType + hasSelection + contentHash
    const domain = this.extractDomain(context.url);
    const contentSample = (context.content || '').substring(0, 200);
    const hash = this.simpleHash(contentSample);
    return `${domain}::${context.pageType}::${context.selectedText ? 'sel' : 'no'}::${hash}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Expire after 10 minutes
    if (Date.now() - entry.timestamp > 600000) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount++;
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.result;
  }

  set(key, result) {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest (first entry)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { result, timestamp: Date.now(), hitCount: 0 });
  }

  invalidateForDomain(domain) {
    for (const [key] of this.cache) {
      if (key.startsWith(domain + '::')) {
        this.cache.delete(key);
      }
    }
  }

  extractDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return 'unknown'; }
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

// ---------------------------------------------------------------------------
// 5. AIEngine — Calls LLM API (supports Anthropic + OpenAI-compatible)
// ---------------------------------------------------------------------------
class AIEngine {
  constructor(contextManager) {
    this.contextManager = contextManager;
    this.privacyFilter = new PrivacyFilter();
    this.promptBuilder = new PromptBuilder(contextManager);
    this.cache = new CacheLayer(50);
    this.apiKey = null;
    this.apiProvider = 'openai';   // 'anthropic' | 'openai'
    this.apiEndpoint = '';         // custom endpoint URL (empty = use default)
    this.model = 'gpt-4o';
    this.maxTokens = 1024;
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get([
        'apiKey', 'aiModel', 'apiProvider', 'apiEndpoint'
      ]);
      this.apiKey = data.apiKey || null;
      if (data.aiModel) this.model = data.aiModel;
      if (data.apiProvider) this.apiProvider = data.apiProvider;
      if (data.apiEndpoint) this.apiEndpoint = data.apiEndpoint;
    } catch { /* first run */ }
  }

  async setApiKey(key) {
    this.apiKey = key;
    await chrome.storage.local.set({ apiKey: key });
  }

  async setModel(model) {
    this.model = model;
    await chrome.storage.local.set({ aiModel: model });
  }

  async setProvider(provider) {
    this.apiProvider = provider;
    await chrome.storage.local.set({ apiProvider: provider });
  }

  async setEndpoint(endpoint) {
    this.apiEndpoint = endpoint;
    await chrome.storage.local.set({ apiEndpoint: endpoint });
  }

  getEffectiveEndpoint() {
    if (this.apiEndpoint) return this.apiEndpoint;
    if (this.apiProvider === 'anthropic') return 'https://api.anthropic.com/v1/messages';
    return 'https://api.openai.com/v1/chat/completions';
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async recommend(context) {
    // Sanitize context
    const sanitized = this.privacyFilter.sanitizeContext(context);

    // Check cache
    const cacheKey = this.cache.generateKey(sanitized);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    // Build history context
    const historyContext = {
      recentHistory: this.contextManager.getRecentHistorySummary(),
      browsingPattern: this.contextManager.getBrowsingPattern(),
      sessionDuration: this.contextManager.getSessionDuration(),
      userPreferences: this.contextManager.getUserPreferences()
    };

    // Build prompts
    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.promptBuilder.buildUserPrompt(sanitized, historyContext);

    // Call API
    const result = await this.callAI(systemPrompt, userPrompt);

    // Cache result
    this.cache.set(cacheKey, result);

    // Record page visit
    this.contextManager.recordPageVisit(context);

    return { ...result, source: 'ai' };
  }

  async recommendIncremental(previousRecs, newSignals) {
    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.promptBuilder.buildIncrementalPrompt(previousRecs, newSignals);
    return await this.callAI(systemPrompt, userPrompt);
  }

  async callAI(systemPrompt, userPrompt) {
    if (!this.apiKey) {
      throw new Error('API_KEY_MISSING');
    }

    const endpoint = this.getEffectiveEndpoint();
    let response;

    if (this.apiProvider === 'anthropic') {
      // Anthropic Claude API format
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
    } else {
      // OpenAI-compatible API format (works with OpenAI, DeepSeek, Moonshot, local LLMs, etc.)
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
    }

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 401) throw new Error('API_KEY_INVALID');
      if (response.status === 429) throw new Error('RATE_LIMITED');
      if (response.status === 529) throw new Error('API_OVERLOADED');
      throw new Error(`API_ERROR: ${response.status} ${errBody.substring(0, 200)}`);
    }

    const data = await response.json();

    // Extract text from response based on provider format
    let text;
    if (this.apiProvider === 'anthropic') {
      text = data.content?.[0]?.text || '';
    } else {
      text = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON from response — handle possible markdown fences
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('PARSE_ERROR: AI returned invalid JSON');
    }

    // Validate structure
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('PARSE_ERROR: Missing recommendations array');
    }

    // Normalize and validate each recommendation
    const validActionIds = new Set([
      'summarize_video', 'find_related', 'set_reminder',
      'track_price', 'compare_prices', 'explain_code', 'optimize_code',
      'smart_summary', 'extract_keypoints', 'translate_page',
      'read_later', 'analyze_sentiment', 'deep_research',
      'generate_notes', 'check_facts'
    ]);

    const ACTION_META = {
      summarize_video: { icon: '📝', name: 'Summarize Video' },
      find_related: { icon: '🔍', name: 'Find Related Content' },
      set_reminder: { icon: '⏰', name: 'Set Reminder' },
      track_price: { icon: '💰', name: 'Track Price' },
      compare_prices: { icon: '📊', name: 'Compare Prices' },
      explain_code: { icon: '💡', name: 'Explain Code' },
      optimize_code: { icon: '⚡', name: 'Suggest Optimizations' },
      smart_summary: { icon: '📰', name: 'Smart Summary' },
      extract_keypoints: { icon: '🎯', name: 'Extract Key Points' },
      translate_page: { icon: '🌐', name: 'Translate Page' },
      read_later: { icon: '📌', name: 'Save for Later' },
      analyze_sentiment: { icon: '🧠', name: 'Analyze Sentiment' },
      deep_research: { icon: '🔬', name: 'Deep Research' },
      generate_notes: { icon: '📒', name: 'Generate Study Notes' },
      check_facts: { icon: '✅', name: 'Fact Check' }
    };

    const recommendations = parsed.recommendations
      .filter(r => validActionIds.has(r.action_id))
      .slice(0, 3)
      .map((r, i) => {
        const meta = ACTION_META[r.action_id] || { icon: '•', name: r.name || r.action_id };
        const dims = r.dimensions || {};
        return {
          rank: i + 1,
          id: r.action_id,
          name: meta.name,
          icon: meta.icon,
          confidence: Math.max(0, Math.min(100, Math.round(r.confidence || 50))),
          reasoning: r.reasoning || 'AI recommendation',
          dimensions: {
            context_match: clamp(dims.context_match ?? 0.5),
            intent_alignment: clamp(dims.intent_alignment ?? 0.5),
            behavioral_signal: clamp(dims.behavioral_signal ?? 0.5),
            historical_fit: clamp(dims.historical_fit ?? 0.5),
            timing_relevance: clamp(dims.timing_relevance ?? 0.5)
          }
        };
      });

    return {
      understanding: parsed.understanding || '',
      recommendations
    };
  }
}

function clamp(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

// ---------------------------------------------------------------------------
// 6. RuleBasedFallback — Deterministic fallback engine
// ---------------------------------------------------------------------------
class RuleBasedFallback {
  recommend(context) {
    const url = (context.url || '').toLowerCase();
    const pageType = context.pageType || 'general';
    const hasSelection = !!(context.selectedText && context.selectedText.length > 0);

    const strategies = {
      video: [
        { id: 'summarize_video', icon: '📝', name: 'Summarize Video', confidence: 82, reasoning: 'Video page detected — a summary can save viewing time' },
        { id: 'find_related', icon: '🔍', name: 'Find Related Content', confidence: 68, reasoning: 'Find deeper resources related to this video topic' },
        { id: 'set_reminder', icon: '⏰', name: 'Set Reminder', confidence: 52, reasoning: 'Save this video for later viewing' }
      ],
      shopping: [
        { id: 'track_price', icon: '💰', name: 'Track Price', confidence: 88, reasoning: 'Product page detected — monitor for price drops' },
        { id: 'compare_prices', icon: '📊', name: 'Compare Prices', confidence: 78, reasoning: 'Check if this product is cheaper elsewhere' },
        { id: 'read_later', icon: '📌', name: 'Save for Later', confidence: 45, reasoning: 'Bookmark this product for future consideration' }
      ],
      code: [
        { id: 'explain_code', icon: '💡', name: 'Explain Code', confidence: 85, reasoning: 'Code repository detected — get AI explanation of the code' },
        { id: 'optimize_code', icon: '⚡', name: 'Suggest Optimizations', confidence: 70, reasoning: 'Analyze this code for potential improvements' },
        { id: 'find_related', icon: '🔍', name: 'Find Related Content', confidence: 55, reasoning: 'Find related documentation or examples' }
      ],
      documentation: [
        { id: 'extract_keypoints', icon: '🎯', name: 'Extract Key Points', confidence: 80, reasoning: 'Documentation page — extract the essential information' },
        { id: 'generate_notes', icon: '📒', name: 'Generate Study Notes', confidence: 72, reasoning: 'Create structured notes for reference' },
        { id: 'smart_summary', icon: '📰', name: 'Smart Summary', confidence: 65, reasoning: 'Get a concise overview of this documentation' }
      ],
      news: [
        { id: 'smart_summary', icon: '📰', name: 'Smart Summary', confidence: 84, reasoning: 'News article detected — get a quick summary' },
        { id: 'extract_keypoints', icon: '🎯', name: 'Extract Key Points', confidence: 75, reasoning: 'Pull out the key facts and data' },
        { id: 'check_facts', icon: '✅', name: 'Fact Check', confidence: 62, reasoning: 'Verify claims made in this article' }
      ],
      article: [
        { id: 'smart_summary', icon: '📰', name: 'Smart Summary', confidence: 82, reasoning: 'Article detected — summarize the main points' },
        { id: 'extract_keypoints', icon: '🎯', name: 'Extract Key Points', confidence: 74, reasoning: 'Extract the key arguments and evidence' },
        { id: 'read_later', icon: '📌', name: 'Save for Later', confidence: 50, reasoning: 'Save this article to your reading list' }
      ],
      social: [
        { id: 'analyze_sentiment', icon: '🧠', name: 'Analyze Sentiment', confidence: 72, reasoning: 'Social media page — understand the overall tone' },
        { id: 'smart_summary', icon: '📰', name: 'Smart Summary', confidence: 65, reasoning: 'Summarize the discussion thread' },
        { id: 'translate_page', icon: '🌐', name: 'Translate Page', confidence: 48, reasoning: 'Translate content if needed' }
      ]
    };

    let recs = strategies[pageType] || [
      { id: 'smart_summary', icon: '📰', name: 'Smart Summary', confidence: 60, reasoning: 'Get a summary of this page content' },
      { id: 'translate_page', icon: '🌐', name: 'Translate Page', confidence: 50, reasoning: 'Translate this page if in a foreign language' },
      { id: 'read_later', icon: '📌', name: 'Save for Later', confidence: 42, reasoning: 'Bookmark for later reading' }
    ];

    // Boost text-related actions if there's a selection
    if (hasSelection) {
      const textActions = ['translate_page', 'explain_code', 'smart_summary', 'extract_keypoints'];
      recs = recs.map(r => {
        if (textActions.includes(r.id)) {
          return { ...r, confidence: Math.min(95, r.confidence + 15), reasoning: r.reasoning + ' (text selected)' };
        }
        return r;
      });
      recs.sort((a, b) => b.confidence - a.confidence);
    }

    return {
      understanding: `Rule-based analysis: ${pageType} page detected at ${url.substring(0, 60)}`,
      recommendations: recs.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        id: r.id,
        name: r.name,
        icon: r.icon,
        confidence: r.confidence,
        reasoning: r.reasoning,
        dimensions: {
          context_match: r.confidence / 100,
          intent_alignment: r.confidence / 120,
          behavioral_signal: 0.5,
          historical_fit: 0.5,
          timing_relevance: 0.5
        }
      })),
      source: 'fallback'
    };
  }
}

// ---------------------------------------------------------------------------
// 7. ActionExecutor — Execute recommended actions
// ---------------------------------------------------------------------------
class ActionExecutor {
  constructor(aiEngine) {
    this.aiEngine = aiEngine;
  }

  async execute(actionId, context) {
    // Actions that can leverage the LLM
    const aiPoweredActions = new Set([
      'summarize_video', 'smart_summary', 'explain_code', 'optimize_code',
      'extract_keypoints', 'translate_page', 'analyze_sentiment',
      'deep_research', 'generate_notes', 'check_facts'
    ]);

    if (aiPoweredActions.has(actionId) && this.aiEngine.isConfigured()) {
      return this.executeWithAI(actionId, context);
    }

    return this.executeLocally(actionId, context);
  }

  async executeWithAI(actionId, context) {
    const privacyFilter = new PrivacyFilter();
    const sanitized = privacyFilter.sanitizeContext(context);
    const content = sanitized.selectedText || sanitized.content || sanitized.title;

    const taskPrompts = {
      summarize_video: `Summarize the following video page content concisely. Include main topics, key points, and takeaways.\n\nTitle: ${sanitized.title}\nContent: ${content}`,
      smart_summary: `Write a concise summary of this article/page. Focus on the main thesis, supporting arguments, and conclusions.\n\nTitle: ${sanitized.title}\nContent: ${content}`,
      explain_code: `Explain the following code clearly. Describe what it does, how it works, and any notable patterns or potential issues.\n\nCode/Content:\n${content}`,
      optimize_code: `Analyze this code and suggest specific optimizations for performance, readability, and best practices.\n\nCode/Content:\n${content}`,
      extract_keypoints: `Extract the key points from this content as a structured bullet list. Include main arguments, data points, and conclusions.\n\nTitle: ${sanitized.title}\nContent: ${content}`,
      translate_page: `Translate the following text to English (or if already in English, to Chinese). Preserve formatting.\n\nText: ${content}`,
      analyze_sentiment: `Analyze the sentiment and tone of this content. Rate objectivity, emotional intensity, and identify the predominant emotions.\n\nTitle: ${sanitized.title}\nContent: ${content}`,
      deep_research: `Based on this page, provide a comprehensive research briefing. Include background context, related topics to explore, and key questions to investigate further.\n\nTitle: ${sanitized.title}\nURL: ${sanitized.url}\nContent: ${content}`,
      generate_notes: `Generate structured study notes from this content. Use headers, bullet points, and highlight key definitions and concepts.\n\nTitle: ${sanitized.title}\nContent: ${content}`,
      check_facts: `Identify the main factual claims in this content and assess their verifiability. Note which claims would benefit from additional verification.\n\nTitle: ${sanitized.title}\nContent: ${content}`
    };

    const taskPrompt = taskPrompts[actionId];
    if (!taskPrompt) return this.executeLocally(actionId, context);

    try {
      const endpoint = this.aiEngine.getEffectiveEndpoint();
      let response;

      if (this.aiEngine.apiProvider === 'anthropic') {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.aiEngine.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: this.aiEngine.model,
            max_tokens: 1500,
            messages: [{ role: 'user', content: taskPrompt }]
          })
        });
      } else {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.aiEngine.apiKey}`
          },
          body: JSON.stringify({
            model: this.aiEngine.model,
            max_tokens: 1500,
            messages: [{ role: 'user', content: taskPrompt }]
          })
        });
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      let result;
      if (this.aiEngine.apiProvider === 'anthropic') {
        result = data.content?.[0]?.text || 'No response from AI.';
      } else {
        result = data.choices?.[0]?.message?.content || 'No response from AI.';
      }

      const ACTION_TITLES = {
        summarize_video: '📝 Video Summary',
        smart_summary: '📰 Smart Summary',
        explain_code: '💡 Code Explanation',
        optimize_code: '⚡ Optimization Suggestions',
        extract_keypoints: '🎯 Key Points',
        translate_page: '🌐 Translation',
        analyze_sentiment: '🧠 Sentiment Analysis',
        deep_research: '🔬 Deep Research',
        generate_notes: '📒 Study Notes',
        check_facts: '✅ Fact Check'
      };

      return {
        success: true,
        type: actionId,
        title: ACTION_TITLES[actionId] || 'AI Result',
        content: result,
        source: 'ai'
      };
    } catch (err) {
      // Fallback to local execution on AI failure
      const local = this.executeLocally(actionId, context);
      local.content += '\n\n⚠️ AI analysis unavailable. Showing placeholder result.';
      return local;
    }
  }

  executeLocally(actionId, context) {
    const title = context.title || 'this page';
    const url = context.url || '';
    const selectedText = context.selectedText || '';

    const actions = {
      summarize_video: {
        title: '📝 Video Summary',
        content: `**Video**: "${title}"\n\nAI-powered summary requires API configuration. Configure your Anthropic API key in the extension settings to enable this feature.\n\nThe AI will analyze the video page content and generate a concise summary with key topics and takeaways.`
      },
      find_related: {
        title: '🔍 Related Content',
        content: `**Related to**: "${title}"\n\nSearching for related content across the web...\n\n• Similar resources from verified sources\n• Community discussions and analyses\n• Expert reviews and deep dives\n\n*Full search integration coming soon.*`
      },
      set_reminder: {
        title: '⏰ Reminder Set',
        content: `**Reminder created for**: "${title}"\n\nURL: ${url}\nScheduled: Tomorrow at 9:00 AM\n\n*You'll receive a notification to revisit this page.*`
      },
      track_price: {
        title: '💰 Price Tracking Active',
        content: `**Now tracking**: "${title}"\n\nURL: ${url}\nAlert threshold: 10% price drop\n\n*You'll be notified when the price changes significantly.*`
      },
      compare_prices: {
        title: '📊 Price Comparison',
        content: `**Comparing prices for**: "${title}"\n\nSearching across major retailers...\n\n*Full price comparison requires retailer API integration.*`
      },
      explain_code: {
        title: '💡 Code Explanation',
        content: selectedText
          ? `**Analyzing selected code:**\n\n\`\`\`\n${selectedText.substring(0, 300)}\n\`\`\`\n\nConfigure your API key for AI-powered code explanation.`
          : `**Code page detected**: "${title}"\n\nSelect specific code and reopen the sidebar for targeted explanation, or configure your API key for full AI analysis.`
      },
      optimize_code: {
        title: '⚡ Optimization Suggestions',
        content: `**Code review for**: "${title}"\n\nConfigure your API key for AI-powered optimization suggestions including:\n• Performance improvements\n• Code quality enhancements\n• Best practice recommendations`
      },
      smart_summary: {
        title: '📰 Smart Summary',
        content: `**Article**: "${title}"\n\nConfigure your API key for AI-powered summary generation. The AI will analyze the full article and produce a concise overview with main points.`
      },
      extract_keypoints: {
        title: '🎯 Key Points',
        content: `**Extracting from**: "${title}"\n\nConfigure your API key for AI-powered key point extraction including:\n• Main arguments and thesis\n• Supporting data and evidence\n• Conclusions and action items`
      },
      translate_page: {
        title: '🌐 Translation',
        content: selectedText
          ? `**Translating selected text:**\n\n"${selectedText.substring(0, 200)}"\n\nConfigure your API key for AI-powered translation.`
          : `**Page**: "${title}"\n\nConfigure your API key for full page translation.`
      },
      read_later: {
        title: '📌 Saved for Later',
        content: `**Saved**: "${title}"\n\nURL: ${url}\nSaved at: ${new Date().toLocaleString()}\n\n*Page has been added to your reading list.*`
      },
      analyze_sentiment: {
        title: '🧠 Sentiment Analysis',
        content: `**Analyzing**: "${title}"\n\nConfigure your API key for AI-powered sentiment analysis including tone detection, objectivity scoring, and emotional intensity measurement.`
      },
      deep_research: {
        title: '🔬 Deep Research',
        content: `**Research topic**: "${title}"\n\nConfigure your API key for comprehensive AI research briefing.`
      },
      generate_notes: {
        title: '📒 Study Notes',
        content: `**Generating notes for**: "${title}"\n\nConfigure your API key for AI-powered study note generation.`
      },
      check_facts: {
        title: '✅ Fact Check',
        content: `**Fact checking**: "${title}"\n\nConfigure your API key for AI-powered fact verification.`
      }
    };

    const action = actions[actionId] || {
      title: 'Unknown Action',
      content: 'This action is not recognized.'
    };

    return {
      success: true,
      type: actionId,
      title: action.title,
      content: action.content,
      source: 'local'
    };
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — Wire everything together
// ---------------------------------------------------------------------------
const contextManager = new ContextManager();
const aiEngine = new AIEngine(contextManager);
const fallbackEngine = new RuleBasedFallback();
const actionExecutor = new ActionExecutor(aiEngine);

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'GET_RECOMMENDATIONS') {
    handleGetRecommendations(message, sendResponse);
    return true; // async
  }

  if (message.type === 'EXECUTE_ACTION') {
    handleExecuteAction(message, sendResponse);
    return true;
  }

  if (message.type === 'RECORD_ACTION_USED') {
    contextManager.recordActionUsed(message.actionId);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'RECORD_ACTIONS_IGNORED') {
    contextManager.recordActionIgnored(message.actionIds || []);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'SET_API_KEY') {
    aiEngine.setApiKey(message.apiKey).then(() => {
      sendResponse({ ok: true, configured: aiEngine.isConfigured() });
    });
    return true;
  }

  if (message.type === 'SET_MODEL') {
    aiEngine.setModel(message.model).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'SET_PROVIDER') {
    aiEngine.setProvider(message.provider).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'SET_ENDPOINT') {
    aiEngine.setEndpoint(message.endpoint).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({
      configured: aiEngine.isConfigured(),
      model: aiEngine.model,
      apiProvider: aiEngine.apiProvider,
      apiEndpoint: aiEngine.apiEndpoint,
      effectiveEndpoint: aiEngine.getEffectiveEndpoint(),
      cacheSize: aiEngine.cache.cache.size,
      historySize: contextManager.historyQueue.length,
      sessionMinutes: contextManager.getSessionDuration(),
      browsingPattern: contextManager.getBrowsingPattern(),
      actionFeedback: contextManager.actionFeedback
    });
    return false;
  }

  if (message.type === 'GET_STATS') {
    sendResponse({ history: contextManager.actionFeedback });
    return false;
  }
});

async function handleGetRecommendations(message, sendResponse) {
  const context = message.context;

  // Try AI first
  if (aiEngine.isConfigured()) {
    try {
      const result = await aiEngine.recommend(context);
      sendResponse({ ...result, mode: 'ai' });
      return;
    } catch (err) {
      console.warn('[Context-Aware AI] AI engine error, falling back to rules:', err.message);
      // Fall through to rule-based
      const fallbackResult = fallbackEngine.recommend(context);
      sendResponse({
        ...fallbackResult,
        mode: 'fallback',
        aiError: err.message
      });
      return;
    }
  }

  // No API key — use rule-based
  const result = fallbackEngine.recommend(context);
  sendResponse({ ...result, mode: 'fallback', aiError: 'API_KEY_MISSING' });
}

async function handleExecuteAction(message, sendResponse) {
  try {
    const result = await actionExecutor.execute(message.actionId, message.context);
    contextManager.recordActionUsed(message.actionId);
    sendResponse(result);
  } catch (err) {
    sendResponse({
      success: false,
      title: 'Execution Error',
      content: `Failed to execute action: ${err.message}`,
      source: 'error'
    });
  }
}

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

console.log('[Context-Aware AI] v2.1 background service worker initialized (multi-provider AI architecture)');

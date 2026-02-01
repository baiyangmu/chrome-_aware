// ============================================================================
// Context-Aware AI Assistant v2.0 — Content Script
// Rich Context Collection + Behavior Tracking + Sidebar UI
// ============================================================================

(function () {
  'use strict';

  if (window.__contextAwareAI) return;
  window.__contextAwareAI = true;

  // -------------------------------------------------------------------------
  // ContextAnalyzer — Deep page analysis with structural and behavioral data
  // -------------------------------------------------------------------------
  class ContextAnalyzer {
    constructor() {
      this.pageLoadTime = Date.now();
      this.maxScrollDepth = 0;
      this.interactionCount = 0;
      this.lastInteraction = Date.now();
      this.setupBehaviorTracking();
    }

    setupBehaviorTracking() {
      // Track scroll depth
      window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = Math.max(
          document.body.scrollHeight, document.documentElement.scrollHeight
        ) - window.innerHeight;
        if (docHeight > 0) {
          const depth = Math.round((scrollTop / docHeight) * 100);
          this.maxScrollDepth = Math.max(this.maxScrollDepth, depth);
        }
      }, { passive: true });

      // Track interactions
      const bumpInteraction = () => {
        this.interactionCount++;
        this.lastInteraction = Date.now();
      };
      document.addEventListener('click', bumpInteraction, { passive: true });
      document.addEventListener('keydown', bumpInteraction, { passive: true });
    }

    analyze() {
      return {
        url: location.href,
        title: document.title,
        pageType: this.detectPageType(),
        content: this.extractContent(),
        selectedText: window.getSelection()?.toString() || '',
        metaDescription: this.getMetaTag('description'),
        metaKeywords: this.getMetaTag('keywords'),
        ogType: this.getMetaProperty('og:type'),
        structuralFeatures: this.analyzeStructure(),
        behaviorSignals: this.captureBehavior()
      };
    }

    // --- Page type detection (heuristic pre-classification for prompt context) ---
    detectPageType() {
      const url = location.href.toLowerCase();
      const hostname = location.hostname.toLowerCase();
      const ogType = (this.getMetaProperty('og:type') || '').toLowerCase();
      const meta = this.getAllMetaContent();

      // Video
      if (
        hostname.includes('youtube.com') || hostname.includes('youtu.be') ||
        hostname.includes('vimeo.com') || hostname.includes('bilibili.com') ||
        hostname.includes('twitch.tv') || hostname.includes('dailymotion.com') ||
        hostname.includes('netflix.com') ||
        ogType === 'video' || ogType === 'video.other' ||
        document.querySelector('video[src], video source, .html5-video-player, .video-player')
      ) return 'video';

      // Shopping / Product
      if (
        hostname.includes('amazon.') || hostname.includes('ebay.') ||
        hostname.includes('walmart.com') || hostname.includes('bestbuy.com') ||
        hostname.includes('taobao.com') || hostname.includes('jd.com') ||
        hostname.includes('shopify.com') || hostname.includes('etsy.com') ||
        hostname.includes('aliexpress.') ||
        ogType === 'product' ||
        document.querySelector('[data-price], .price, .product-price, #priceblock_ourprice, [itemprop="price"]') ||
        meta.includes('product') || url.includes('/product') || url.includes('/item') ||
        url.includes('/dp/') || url.includes('/gp/product')
      ) return 'shopping';

      // Code
      if (
        hostname.includes('github.com') || hostname.includes('gitlab.com') ||
        hostname.includes('bitbucket.org') || hostname.includes('codepen.io') ||
        hostname.includes('codesandbox.io') || hostname.includes('replit.com') ||
        hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com') ||
        hostname.includes('leetcode.com') || hostname.includes('hackerrank.com') ||
        document.querySelectorAll('pre code, .highlight, .CodeMirror, .monaco-editor').length > 2
      ) return 'code';

      // Documentation
      if (
        hostname.includes('docs.') || hostname.includes('wiki.') ||
        hostname.includes('readthedocs.') || hostname.includes('gitbook.') ||
        hostname.includes('developer.mozilla.org') || hostname.includes('devdocs.io') ||
        url.includes('/docs/') || url.includes('/wiki/') || url.includes('/documentation/') ||
        url.includes('/api/') || url.includes('/reference/')
      ) return 'documentation';

      // News
      if (
        hostname.includes('nytimes.com') || hostname.includes('bbc.com') ||
        hostname.includes('cnn.com') || hostname.includes('reuters.com') ||
        hostname.includes('apnews.com') || hostname.includes('theguardian.com') ||
        hostname.includes('washingtonpost.com') || hostname.includes('bloomberg.com') ||
        ogType === 'article' && meta.includes('news') ||
        document.querySelector('[itemtype*="NewsArticle"]')
      ) return 'news';

      // Social
      if (
        hostname.includes('twitter.com') || hostname.includes('x.com') ||
        hostname.includes('reddit.com') || hostname.includes('facebook.com') ||
        hostname.includes('instagram.com') || hostname.includes('linkedin.com') ||
        hostname.includes('mastodon.') || hostname.includes('threads.net')
      ) return 'social';

      // Article / Blog
      if (
        hostname.includes('medium.com') || hostname.includes('dev.to') ||
        hostname.includes('hashnode.') || hostname.includes('substack.com') ||
        hostname.includes('wordpress.com') || hostname.includes('blogger.com') ||
        ogType === 'article' ||
        document.querySelector('article, [itemtype*="Article"], .post-content, .article-body, .entry-content')
      ) return 'article';

      // Academic
      if (
        hostname.includes('arxiv.org') || hostname.includes('scholar.google') ||
        hostname.includes('pubmed.') || hostname.includes('researchgate.net') ||
        hostname.includes('academia.edu') || hostname.includes('ieee.org')
      ) return 'academic';

      return 'general';
    }

    // --- Structural analysis ---
    analyzeStructure() {
      const features = {};

      // Media elements
      const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
      if (videos.length > 0) features.hasVideo = true;
      features.videoCount = videos.length;

      const images = document.querySelectorAll('img');
      features.imageCount = images.length;

      // Code elements
      const codeBlocks = document.querySelectorAll('pre code, .highlight pre, .CodeMirror, .monaco-editor');
      if (codeBlocks.length > 0) features.hasCode = true;
      features.codeBlockCount = codeBlocks.length;

      // Detect programming language hints
      if (codeBlocks.length > 0) {
        const langClasses = [];
        codeBlocks.forEach(el => {
          const classes = el.className || el.parentElement?.className || '';
          const match = classes.match(/language-(\w+)|lang-(\w+)|highlight-source-(\w+)/);
          if (match) langClasses.push(match[1] || match[2] || match[3]);
        });
        if (langClasses.length > 0) features.codeLanguages = [...new Set(langClasses)].join(', ');
      }

      // Forms / shopping indicators
      const forms = document.querySelectorAll('form');
      features.formCount = forms.length;
      features.hasAddToCart = !!document.querySelector(
        '[class*="add-to-cart"], [class*="addToCart"], [id*="add-to-cart"], button[name="add"], [data-action="add-to-cart"]'
      );
      features.hasPriceElement = !!document.querySelector(
        '[class*="price"], [itemprop="price"], [data-price]'
      );

      // Navigation structure
      features.hasNav = !!document.querySelector('nav, [role="navigation"]');
      features.hasSidebar = !!document.querySelector('aside, [role="complementary"], .sidebar');
      features.hasComments = !!document.querySelector(
        '.comments, #comments, [class*="comment-list"], .discussion'
      );

      // Content structure
      const headings = document.querySelectorAll('h1, h2, h3');
      features.headingCount = headings.length;
      if (headings.length > 0) {
        features.mainHeading = headings[0]?.textContent?.trim().substring(0, 100) || '';
      }

      // Article indicators
      const article = document.querySelector('article, [role="article"]');
      features.hasArticleTag = !!article;
      features.hasTimeTag = !!document.querySelector('time, [datetime]');

      // Table of contents
      features.hasTOC = !!document.querySelector(
        '.toc, .table-of-contents, [class*="TableOfContents"], nav[class*="toc"]'
      );

      // Social elements
      features.hasShareButtons = !!document.querySelector(
        '[class*="share"], [class*="social-buttons"], .social-share'
      );

      // Estimated word count of main content
      const mainContent = document.querySelector('article, main, [role="main"], .content, #content');
      if (mainContent) {
        const words = (mainContent.innerText || '').split(/\s+/).length;
        features.estimatedWordCount = words;
        features.estimatedReadMinutes = Math.ceil(words / 200);
      }

      return features;
    }

    // --- Behavior signals ---
    captureBehavior() {
      const dwellTime = Math.round((Date.now() - this.pageLoadTime) / 1000);
      const selection = window.getSelection()?.toString() || '';

      let interactionLevel = 'passive';
      if (this.interactionCount > 20) interactionLevel = 'heavy';
      else if (this.interactionCount > 5) interactionLevel = 'active';
      else if (this.interactionCount > 0) interactionLevel = 'light';

      let focusedElementType = 'none';
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') focusedElementType = 'text_input';
        else if (tag === 'select') focusedElementType = 'select';
        else if (tag === 'video') focusedElementType = 'video';
        else if (active.isContentEditable) focusedElementType = 'editor';
      }

      return {
        dwellTime,
        scrollDepth: this.maxScrollDepth,
        interactionCount: this.interactionCount,
        interactionLevel,
        hasSelection: selection.length > 0,
        selectionLength: selection.length,
        focusedElementType
      };
    }

    // --- Meta tag helpers ---
    getMetaTag(name) {
      const el = document.querySelector(`meta[name="${name}"]`) ||
                 document.querySelector(`meta[name="${name}" i]`);
      return el?.getAttribute('content') || '';
    }

    getMetaProperty(property) {
      const el = document.querySelector(`meta[property="${property}"]`);
      return el?.getAttribute('content') || '';
    }

    getAllMetaContent() {
      let content = '';
      document.querySelectorAll('meta[property], meta[name]').forEach(m => {
        content += ' ' + (m.getAttribute('content') || '');
      });
      return content.toLowerCase();
    }

    extractContent() {
      // Prioritize article / main content, skip nav, footer, ads
      const selectors = [
        'article', 'main', '[role="main"]', '.post-content', '.article-body',
        '.entry-content', '.content', '#content', '.post', '.story-body'
      ];

      let source = null;
      for (const sel of selectors) {
        source = document.querySelector(sel);
        if (source) break;
      }
      if (!source) source = document.body;

      // Clone and strip unwanted elements
      const clone = source.cloneNode(true);
      clone.querySelectorAll('nav, footer, header, script, style, .ad, .ads, .advertisement, [role="navigation"], [role="banner"]').forEach(el => el.remove());

      const text = clone.innerText || clone.textContent || '';
      // Clean up excessive whitespace
      return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').substring(0, 2000);
    }
  }

  // -------------------------------------------------------------------------
  // SidebarUI — Build and manage the sidebar
  // -------------------------------------------------------------------------
  class SidebarUI {
    constructor() {
      this.isOpen = false;
      this.sidebar = null;
      this.overlay = null;
      this.analyzer = new ContextAnalyzer();
      this.currentContext = null;
      this.recommendations = [];
      this.currentMode = null;  // 'ai' | 'fallback' | 'cache'
      this.aiError = null;
    }

    create() {
      // Overlay
      this.overlay = document.createElement('div');
      this.overlay.id = 'caa-overlay';
      this.overlay.addEventListener('click', () => this.close());

      // Sidebar
      this.sidebar = document.createElement('div');
      this.sidebar.id = 'caa-sidebar';
      this.sidebar.innerHTML = this.getTemplate();

      document.body.appendChild(this.overlay);
      document.body.appendChild(this.sidebar);

      // Bind buttons
      this.sidebar.querySelector('#caa-close-btn').addEventListener('click', () => this.close());
      this.sidebar.querySelector('#caa-refresh-btn').addEventListener('click', () => this.refresh());
      this.sidebar.querySelector('#caa-settings-toggle').addEventListener('click', () => this.toggleSettings());
    }

    getTemplate() {
      return `
        <div class="caa-header">
          <div class="caa-header-left">
            <span class="caa-logo">✦</span>
            <span class="caa-title">AI Assistant</span>
            <span id="caa-mode-badge" class="caa-mode-badge caa-mode-loading">...</span>
          </div>
          <div class="caa-header-right">
            <button id="caa-settings-toggle" class="caa-icon-btn" title="Settings">⚙</button>
            <button id="caa-refresh-btn" class="caa-icon-btn" title="Refresh">↻</button>
            <button id="caa-close-btn" class="caa-icon-btn" title="Close (Ctrl+Shift+K)">✕</button>
          </div>
        </div>

        <div id="caa-settings-panel" class="caa-settings-panel" style="display:none;">
          <div class="caa-settings-title">API Configuration</div>
          <div class="caa-settings-row">
            <label class="caa-settings-label">Anthropic API Key</label>
            <div class="caa-input-group">
              <input type="password" id="caa-api-key-input" class="caa-input"
                     placeholder="sk-ant-..." autocomplete="off" />
              <button id="caa-save-key-btn" class="caa-save-btn">Save</button>
            </div>
          </div>
          <div class="caa-settings-row">
            <label class="caa-settings-label">Model</label>
            <select id="caa-model-select" class="caa-select">
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
              <option value="claude-haiku-4-20250414">Claude Haiku 4</option>
              <option value="claude-opus-4-20250514">Claude Opus 4</option>
            </select>
          </div>
          <div id="caa-settings-status" class="caa-settings-status"></div>
        </div>

        <div class="caa-context-bar">
          <div class="caa-context-label">Page Context</div>
          <div id="caa-context-info" class="caa-context-info">Analyzing...</div>
        </div>

        <div id="caa-understanding" class="caa-understanding" style="display:none;">
          <span class="caa-understanding-icon">🧠</span>
          <span id="caa-understanding-text" class="caa-understanding-text"></span>
        </div>

        <div class="caa-divider"></div>
        <div class="caa-section-title">Top Recommendations</div>
        <div id="caa-recommendations" class="caa-recommendations">
          <div class="caa-loading">
            <div class="caa-spinner"></div>
            <span>Analyzing page context...</span>
          </div>
        </div>

        <div id="caa-result-panel" class="caa-result-panel" style="display:none;">
          <div class="caa-result-header">
            <span id="caa-result-title" class="caa-result-title"></span>
            <button id="caa-result-close" class="caa-icon-btn caa-small-btn">✕</button>
          </div>
          <div id="caa-result-content" class="caa-result-content"></div>
        </div>

        <div class="caa-footer">
          <span class="caa-footer-text">Context-Aware AI v2.0</span>
          <span class="caa-shortcut-hint">Ctrl+Shift+K</span>
        </div>
      `;
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      if (!this.sidebar) this.create();
      this.isOpen = true;
      this.sidebar.classList.add('caa-open');
      this.overlay.classList.add('caa-visible');
      document.body.classList.add('caa-body-shifted');
      this.initSettings();
      this.loadRecommendations();
    }

    close() {
      if (!this.sidebar) return;
      this.isOpen = false;
      this.sidebar.classList.remove('caa-open');
      this.overlay.classList.remove('caa-visible');
      document.body.classList.remove('caa-body-shifted');
    }

    refresh() {
      this.loadRecommendations();
    }

    // --- Settings panel ---
    async initSettings() {
      try {
        const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        const keyInput = this.sidebar.querySelector('#caa-api-key-input');
        const modelSelect = this.sidebar.querySelector('#caa-model-select');

        if (status.configured) {
          keyInput.placeholder = '••••••••••••••••••  (configured)';
        }
        modelSelect.value = status.model || 'claude-sonnet-4-20250514';

        // Bind save
        this.sidebar.querySelector('#caa-save-key-btn').onclick = async () => {
          const key = keyInput.value.trim();
          if (!key) return;
          const statusEl = this.sidebar.querySelector('#caa-settings-status');
          statusEl.textContent = 'Saving...';
          statusEl.className = 'caa-settings-status';

          const res = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: key });
          if (res.configured) {
            statusEl.textContent = 'API key saved. Recommendations will now use AI.';
            statusEl.className = 'caa-settings-status caa-status-success';
            keyInput.value = '';
            keyInput.placeholder = '••••••••••••••••••  (configured)';
            this.loadRecommendations(); // refresh with AI
          } else {
            statusEl.textContent = 'Failed to save.';
            statusEl.className = 'caa-settings-status caa-status-error';
          }
        };

        // Bind model change
        modelSelect.onchange = async () => {
          await chrome.runtime.sendMessage({ type: 'SET_MODEL', model: modelSelect.value });
          this.sidebar.querySelector('#caa-settings-status').textContent = 'Model updated.';
        };

      } catch { /* extension context lost */ }
    }

    toggleSettings() {
      const panel = this.sidebar.querySelector('#caa-settings-panel');
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
    }

    // --- Load and render recommendations ---
    async loadRecommendations() {
      const recContainer = this.sidebar.querySelector('#caa-recommendations');
      const contextInfo = this.sidebar.querySelector('#caa-context-info');
      const modeBadge = this.sidebar.querySelector('#caa-mode-badge');
      const understandingEl = this.sidebar.querySelector('#caa-understanding');

      // Loading state
      modeBadge.textContent = '...';
      modeBadge.className = 'caa-mode-badge caa-mode-loading';
      recContainer.innerHTML = `
        <div class="caa-loading">
          <div class="caa-spinner"></div>
          <span>Analyzing page context...</span>
        </div>
      `;
      understandingEl.style.display = 'none';

      // Collect rich context
      this.currentContext = this.analyzer.analyze();

      // Context bar
      const typeEmojis = {
        video: '🎬', shopping: '🛒', code: '💻', documentation: '📚',
        news: '📰', social: '💬', article: '📄', academic: '🎓', general: '🌐'
      };
      const emoji = typeEmojis[this.currentContext.pageType] || '🌐';
      const typeName = this.currentContext.pageType.charAt(0).toUpperCase() + this.currentContext.pageType.slice(1);
      const sf = this.currentContext.structuralFeatures || {};
      const bs = this.currentContext.behaviorSignals || {};

      let contextParts = `
        <span class="caa-context-type">${emoji} ${typeName}</span>
        <span class="caa-context-url" title="${this.currentContext.url}">${this.truncateUrl(this.currentContext.url)}</span>
      `;
      if (this.currentContext.selectedText) {
        contextParts += '<span class="caa-context-selection">📋 Text selected</span>';
      }
      if (sf.estimatedReadMinutes) {
        contextParts += `<span class="caa-context-meta">📖 ~${sf.estimatedReadMinutes}min read</span>`;
      }
      if (bs.scrollDepth > 0) {
        contextParts += `<span class="caa-context-meta">📜 ${bs.scrollDepth}% scrolled</span>`;
      }
      if (sf.hasCode) {
        contextParts += `<span class="caa-context-meta">🔤 ${sf.codeBlockCount} code blocks${sf.codeLanguages ? ' (' + sf.codeLanguages + ')' : ''}</span>`;
      }
      contextInfo.innerHTML = contextParts;

      // Request recommendations from background
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_RECOMMENDATIONS',
          context: this.currentContext
        });

        this.currentMode = response.mode || response.source || 'unknown';
        this.aiError = response.aiError || null;
        this.recommendations = response.recommendations || [];

        // Mode badge
        if (this.currentMode === 'ai' || response.source === 'ai') {
          modeBadge.textContent = 'AI';
          modeBadge.className = 'caa-mode-badge caa-mode-ai';
        } else if (response.source === 'cache') {
          modeBadge.textContent = 'Cached';
          modeBadge.className = 'caa-mode-badge caa-mode-cache';
        } else {
          modeBadge.textContent = 'Rules';
          modeBadge.className = 'caa-mode-badge caa-mode-fallback';
        }

        // Understanding (AI insight)
        if (response.understanding && this.currentMode !== 'fallback') {
          understandingEl.style.display = 'flex';
          this.sidebar.querySelector('#caa-understanding-text').textContent = response.understanding;
        }

        // Show AI error banner if fallback due to error
        if (this.aiError && this.aiError !== 'API_KEY_MISSING') {
          const errorLabels = {
            API_KEY_INVALID: 'Invalid API key. Check settings.',
            RATE_LIMITED: 'Rate limited. Using rule-based fallback.',
            API_OVERLOADED: 'API overloaded. Using rule-based fallback.',
          };
          const label = errorLabels[this.aiError] || `AI error: ${this.aiError}`;
          recContainer.innerHTML = `<div class="caa-ai-error-banner">⚠️ ${label}</div>`;
          // Then append recommendations below
          this.renderRecommendations(true);
        } else if (this.aiError === 'API_KEY_MISSING') {
          recContainer.innerHTML = `<div class="caa-setup-banner">
            <span class="caa-setup-icon">🔑</span>
            <span>Configure your API key in <strong>Settings</strong> (⚙) to enable AI-powered recommendations.</span>
          </div>`;
          this.renderRecommendations(true);
        } else {
          this.renderRecommendations(false);
        }

      } catch (err) {
        recContainer.innerHTML = `
          <div class="caa-error">
            <span>⚠️ Failed to load recommendations</span>
            <button class="caa-retry-btn" id="caa-retry-btn">Retry</button>
          </div>
        `;
        this.sidebar.querySelector('#caa-retry-btn')?.addEventListener('click', () => this.refresh());
        modeBadge.textContent = 'Error';
        modeBadge.className = 'caa-mode-badge caa-mode-error';
      }
    }

    renderRecommendations(append = false) {
      const container = this.sidebar.querySelector('#caa-recommendations');
      const medals = ['🥇', '🥈', '🥉'];

      const dimensionLabels = {
        context_match: 'Context',
        intent_alignment: 'Intent',
        behavioral_signal: 'Behavior',
        historical_fit: 'History',
        timing_relevance: 'Timing'
      };

      const html = this.recommendations.map((rec, i) => {
        const medal = medals[i] || '•';
        const confidenceGradient =
          rec.confidence >= 70 ? 'linear-gradient(90deg, #00d2ff, #3a7bd5)' :
          rec.confidence >= 50 ? 'linear-gradient(90deg, #f7971e, #ffd200)' :
          'linear-gradient(90deg, #8e9eab, #eef2f3)';

        const dims = rec.dimensions || {};
        const breakdownHtml = Object.entries(dimensionLabels).map(([key, label]) => {
          const val = dims[key] ?? 0.5;
          const pct = Math.round(val * 100);
          return `<div class="caa-breakdown-item">
            <span class="caa-bd-label">${label}</span>
            <div class="caa-bd-bar"><div class="caa-bd-fill" style="width:${pct}%"></div></div>
            <span class="caa-bd-score">${pct}%</span>
          </div>`;
        }).join('');

        return `
          <div class="caa-rec-card" data-action-id="${rec.id}" data-rank="${rec.rank}">
            <div class="caa-rec-header">
              <span class="caa-rec-medal">${medal}</span>
              <span class="caa-rec-icon">${rec.icon}</span>
              <span class="caa-rec-name">${rec.name}</span>
              <span class="caa-rec-score">${rec.confidence}%</span>
            </div>
            <div class="caa-rec-reason">${rec.reasoning}</div>
            <div class="caa-rec-confidence">
              <div class="caa-confidence-bar">
                <div class="caa-confidence-fill" style="width:${rec.confidence}%; background:${confidenceGradient};"></div>
              </div>
              <span class="caa-confidence-label">Confidence: ${rec.confidence}%</span>
            </div>
            <div class="caa-rec-breakdown">
              <div class="caa-breakdown-grid">${breakdownHtml}</div>
            </div>
            <button class="caa-exec-btn" data-action="${rec.id}">
              Execute ${rec.icon} ${rec.name}
            </button>
          </div>
        `;
      }).join('');

      if (append) {
        container.innerHTML += html;
      } else {
        container.innerHTML = html;
      }

      // Bind buttons
      container.querySelectorAll('.caa-exec-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const actionId = e.target.closest('.caa-exec-btn').dataset.action;
          this.executeAction(actionId);
        });
      });

      // Animate cards
      container.querySelectorAll('.caa-rec-card').forEach((card, i) => {
        card.style.animationDelay = `${i * 0.12}s`;
        card.classList.add('caa-card-animate');
      });
    }

    async executeAction(actionId) {
      const btn = this.sidebar.querySelector(`[data-action="${actionId}"]`);
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Running...';
      }

      try {
        const result = await chrome.runtime.sendMessage({
          type: 'EXECUTE_ACTION',
          actionId,
          context: this.currentContext
        });

        this.showResult(result);

        // Record feedback: user used this, ignored others
        chrome.runtime.sendMessage({ type: 'RECORD_ACTION_USED', actionId });
        const ignoredIds = this.recommendations
          .map(r => r.id)
          .filter(id => id !== actionId);
        if (ignoredIds.length > 0) {
          chrome.runtime.sendMessage({ type: 'RECORD_ACTIONS_IGNORED', actionIds: ignoredIds });
        }
      } catch (err) {
        this.showResult({
          success: false,
          title: 'Error',
          content: 'Failed to execute action. Please try again.'
        });
      } finally {
        if (btn) {
          const rec = this.recommendations.find(r => r.id === actionId);
          if (rec) {
            btn.disabled = false;
            btn.textContent = `Execute ${rec.icon} ${rec.name}`;
          }
        }
      }
    }

    showResult(result) {
      const panel = this.sidebar.querySelector('#caa-result-panel');
      const title = this.sidebar.querySelector('#caa-result-title');
      const content = this.sidebar.querySelector('#caa-result-content');
      const closeBtn = this.sidebar.querySelector('#caa-result-close');

      title.textContent = result.title || 'Result';

      // Show source badge
      const sourceBadge = result.source === 'ai'
        ? '<span class="caa-result-source caa-source-ai">AI Generated</span>'
        : result.source === 'local'
          ? '<span class="caa-result-source caa-source-local">Placeholder</span>'
          : '';

      content.innerHTML = sourceBadge + this.formatMarkdown(result.content || 'No content returned.');
      panel.style.display = 'block';

      // Force reflow for animation
      panel.offsetHeight;
      panel.classList.add('caa-result-show');

      closeBtn.onclick = () => {
        panel.classList.remove('caa-result-show');
        setTimeout(() => { panel.style.display = 'none'; }, 300);
      };
    }

    formatMarkdown(text) {
      return text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="caa-code-block"><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n{2,}/g, '<br><br>')
        .replace(/\n/g, '<br>');
    }

    truncateUrl(url) {
      try {
        const u = new URL(url);
        const path = u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname;
        return u.hostname + path;
      } catch {
        return url?.substring(0, 50) || '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Initialize
  // -------------------------------------------------------------------------
  const ui = new SidebarUI();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_SIDEBAR') {
      ui.toggle();
    }
  });

  console.log('[Context-Aware AI] v2.0 content script loaded on', location.href);
})();

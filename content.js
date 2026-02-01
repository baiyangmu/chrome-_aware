// ============================================================================
// Context-Aware AI Assistant - Content Script
// Page Analysis + Sidebar UI Injection
// ============================================================================

(function () {
  'use strict';

  // Prevent double injection
  if (window.__contextAwareAI) return;
  window.__contextAwareAI = true;

  // -------------------------------------------------------------------------
  // ContextAnalyzer - Analyze current page
  // -------------------------------------------------------------------------
  class ContextAnalyzer {
    analyze() {
      return {
        url: location.href,
        title: document.title,
        pageType: this.detectPageType(),
        content: this.extractContent(),
        selectedText: window.getSelection()?.toString() || ''
      };
    }

    detectPageType() {
      const url = location.href.toLowerCase();
      const hostname = location.hostname.toLowerCase();
      const title = document.title.toLowerCase();
      const meta = this.getMetaContent();

      // Video platforms
      if (
        hostname.includes('youtube.com') || hostname.includes('youtu.be') ||
        hostname.includes('vimeo.com') || hostname.includes('bilibili.com') ||
        hostname.includes('twitch.tv') || hostname.includes('dailymotion.com') ||
        document.querySelector('video[src], video source, .html5-video-player')
      ) {
        return 'video';
      }

      // Shopping / Product
      if (
        hostname.includes('amazon.') || hostname.includes('ebay.') ||
        hostname.includes('walmart.com') || hostname.includes('bestbuy.com') ||
        hostname.includes('taobao.com') || hostname.includes('jd.com') ||
        hostname.includes('shopify.com') || hostname.includes('etsy.com') ||
        document.querySelector('[data-price], .price, .product-price, #priceblock_ourprice') ||
        meta.includes('product') || url.includes('/product') || url.includes('/item')
      ) {
        return 'shopping';
      }

      // Code platforms
      if (
        hostname.includes('github.com') || hostname.includes('gitlab.com') ||
        hostname.includes('bitbucket.org') || hostname.includes('codepen.io') ||
        hostname.includes('codesandbox.io') || hostname.includes('replit.com') ||
        hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com') ||
        document.querySelectorAll('pre code, .highlight, .CodeMirror, .monaco-editor').length > 2
      ) {
        return 'code';
      }

      // Documentation
      if (
        hostname.includes('docs.') || hostname.includes('wiki.') ||
        hostname.includes('readthedocs.') || hostname.includes('gitbook.') ||
        url.includes('/docs/') || url.includes('/wiki/') || url.includes('/documentation/')
      ) {
        return 'documentation';
      }

      // News
      if (
        hostname.includes('nytimes.com') || hostname.includes('bbc.com') ||
        hostname.includes('cnn.com') || hostname.includes('reuters.com') ||
        hostname.includes('apnews.com') || hostname.includes('theguardian.com') ||
        meta.includes('news') ||
        document.querySelector('article, [itemtype*="NewsArticle"]')
      ) {
        return 'news';
      }

      // Social media
      if (
        hostname.includes('twitter.com') || hostname.includes('x.com') ||
        hostname.includes('reddit.com') || hostname.includes('facebook.com') ||
        hostname.includes('instagram.com') || hostname.includes('linkedin.com')
      ) {
        return 'social';
      }

      // Blog / Article (generic)
      if (
        hostname.includes('medium.com') || hostname.includes('dev.to') ||
        hostname.includes('hashnode.') || hostname.includes('substack.com') ||
        document.querySelector('article, [itemtype*="Article"], .post-content, .article-body') ||
        meta.includes('article')
      ) {
        return 'article';
      }

      return 'general';
    }

    getMetaContent() {
      const metas = document.querySelectorAll('meta[property], meta[name]');
      let content = '';
      metas.forEach(m => {
        content += ' ' + (m.getAttribute('content') || '');
      });
      return content.toLowerCase();
    }

    extractContent() {
      // Get meaningful text content (truncated for performance)
      const article = document.querySelector('article, main, [role="main"], .content, #content');
      const source = article || document.body;
      const text = source?.innerText || '';
      return text.substring(0, 2000);
    }
  }

  // -------------------------------------------------------------------------
  // SidebarUI - Build and manage the sidebar
  // -------------------------------------------------------------------------
  class SidebarUI {
    constructor() {
      this.isOpen = false;
      this.sidebar = null;
      this.overlay = null;
      this.analyzer = new ContextAnalyzer();
      this.currentContext = null;
      this.recommendations = [];
    }

    create() {
      // Overlay
      this.overlay = document.createElement('div');
      this.overlay.id = 'caa-overlay';
      this.overlay.addEventListener('click', () => this.close());

      // Sidebar container
      this.sidebar = document.createElement('div');
      this.sidebar.id = 'caa-sidebar';
      this.sidebar.innerHTML = this.getTemplate();

      document.body.appendChild(this.overlay);
      document.body.appendChild(this.sidebar);

      // Bind close button
      this.sidebar.querySelector('#caa-close-btn').addEventListener('click', () => this.close());

      // Bind refresh button
      this.sidebar.querySelector('#caa-refresh-btn').addEventListener('click', () => this.refresh());
    }

    getTemplate() {
      return `
        <div class="caa-header">
          <div class="caa-header-left">
            <span class="caa-logo">✦</span>
            <span class="caa-title">AI Assistant</span>
          </div>
          <div class="caa-header-right">
            <button id="caa-refresh-btn" class="caa-icon-btn" title="Refresh recommendations">↻</button>
            <button id="caa-close-btn" class="caa-icon-btn" title="Close (Ctrl+Shift+K)">✕</button>
          </div>
        </div>
        <div class="caa-context-bar">
          <div class="caa-context-label">Page Context</div>
          <div id="caa-context-info" class="caa-context-info">Analyzing...</div>
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
          <span class="caa-footer-text">Context-Aware AI · v1.0</span>
          <span class="caa-shortcut-hint">Ctrl+Shift+K</span>
        </div>
      `;
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      if (!this.sidebar) this.create();
      this.isOpen = true;
      this.sidebar.classList.add('caa-open');
      this.overlay.classList.add('caa-visible');
      document.body.classList.add('caa-body-shifted');
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

    async loadRecommendations() {
      const recContainer = this.sidebar.querySelector('#caa-recommendations');
      const contextInfo = this.sidebar.querySelector('#caa-context-info');

      // Show loading
      recContainer.innerHTML = `
        <div class="caa-loading">
          <div class="caa-spinner"></div>
          <span>Analyzing page context...</span>
        </div>
      `;

      // Analyze context
      this.currentContext = this.analyzer.analyze();

      // Update context bar
      const typeEmojis = {
        video: '🎬', shopping: '🛒', code: '💻', documentation: '📚',
        news: '📰', social: '💬', article: '📄', general: '🌐'
      };
      const emoji = typeEmojis[this.currentContext.pageType] || '🌐';
      contextInfo.innerHTML = `
        <span class="caa-context-type">${emoji} ${this.currentContext.pageType.charAt(0).toUpperCase() + this.currentContext.pageType.slice(1)}</span>
        <span class="caa-context-url" title="${this.currentContext.url}">${this.truncateUrl(this.currentContext.url)}</span>
        ${this.currentContext.selectedText ? '<span class="caa-context-selection">📋 Text selected</span>' : ''}
      `;

      // Get recommendations from background
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_RECOMMENDATIONS',
          context: this.currentContext
        });

        this.recommendations = response.recommendations;
        this.renderRecommendations();
      } catch (err) {
        recContainer.innerHTML = `
          <div class="caa-error">
            <span>⚠️ Failed to load recommendations</span>
            <button class="caa-retry-btn" id="caa-retry-btn">Retry</button>
          </div>
        `;
        recContainer.querySelector('#caa-retry-btn')?.addEventListener('click', () => this.refresh());
      }
    }

    renderRecommendations() {
      const container = this.sidebar.querySelector('#caa-recommendations');
      const medals = ['🥇', '🥈', '🥉'];
      const confidenceColors = [
        { min: 70, gradient: 'linear-gradient(90deg, #00d2ff, #3a7bd5)' },
        { min: 50, gradient: 'linear-gradient(90deg, #f7971e, #ffd200)' },
        { min: 0, gradient: 'linear-gradient(90deg, #8e9eab, #eef2f3)' }
      ];

      container.innerHTML = this.recommendations.map((rec, i) => {
        const medal = medals[i] || '•';
        const colorDef = confidenceColors.find(c => rec.confidence >= c.min) || confidenceColors[2];

        return `
          <div class="caa-rec-card" data-action-id="${rec.id}" data-rank="${rec.rank}">
            <div class="caa-rec-header">
              <span class="caa-rec-medal">${medal}</span>
              <span class="caa-rec-icon">${rec.icon}</span>
              <span class="caa-rec-name">${rec.name}</span>
              <span class="caa-rec-score">${rec.score}%</span>
            </div>
            <div class="caa-rec-reason">${rec.reason}</div>
            <div class="caa-rec-confidence">
              <div class="caa-confidence-bar">
                <div class="caa-confidence-fill" style="width:${rec.confidence}%; background:${colorDef.gradient};"></div>
              </div>
              <span class="caa-confidence-label">Confidence: ${rec.confidence}%</span>
            </div>
            <div class="caa-rec-breakdown">
              ${this.renderBreakdown(rec.breakdown)}
            </div>
            <button class="caa-exec-btn" data-action="${rec.id}">
              Execute ${rec.icon} ${rec.name}
            </button>
          </div>
        `;
      }).join('');

      // Bind execute buttons
      container.querySelectorAll('.caa-exec-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const actionId = e.target.closest('.caa-exec-btn').dataset.action;
          this.executeAction(actionId);
        });
      });

      // Animate cards in
      const cards = container.querySelectorAll('.caa-rec-card');
      cards.forEach((card, i) => {
        card.style.animationDelay = `${i * 0.12}s`;
        card.classList.add('caa-card-animate');
      });
    }

    renderBreakdown(breakdown) {
      const dims = [
        { key: 'pageTypeMatch', label: 'Page Match', max: 40 },
        { key: 'scenarioFit', label: 'Scenario', max: 30 },
        { key: 'userBehavior', label: 'Behavior', max: 15 },
        { key: 'urlFeature', label: 'URL', max: 10 },
        { key: 'timeFactor', label: 'Time', max: 5 }
      ];

      return `<div class="caa-breakdown-grid">
        ${dims.map(d => {
          const score = Math.round(breakdown[d.key] * d.max);
          const pct = Math.round(breakdown[d.key] * 100);
          return `<div class="caa-breakdown-item">
            <span class="caa-bd-label">${d.label}</span>
            <div class="caa-bd-bar"><div class="caa-bd-fill" style="width:${pct}%"></div></div>
            <span class="caa-bd-score">${score}/${d.max}</span>
          </div>`;
        }).join('')}
      </div>`;
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
      content.innerHTML = this.formatMarkdown(result.content || 'No content returned.');
      panel.style.display = 'block';
      panel.classList.add('caa-result-show');

      closeBtn.onclick = () => {
        panel.classList.remove('caa-result-show');
        setTimeout(() => { panel.style.display = 'none'; }, 300);
      };
    }

    formatMarkdown(text) {
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\n/g, '<br>');
    }

    truncateUrl(url) {
      try {
        const u = new URL(url);
        const path = u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname;
        return u.hostname + path;
      } catch {
        return url?.substring(0, 40) || '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // Initialize
  // -------------------------------------------------------------------------
  const ui = new SidebarUI();

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_SIDEBAR') {
      ui.toggle();
    }
  });

  // Log initialization
  console.log('[Context-Aware AI] Content script loaded on', location.href);
})();

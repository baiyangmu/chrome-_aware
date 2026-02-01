// ============================================================================
// Context-Aware AI Assistant v2.1 — Popup Script
// ============================================================================

const ACTION_META = {
  summarize_video:   { icon: '📝', name: 'Summarize Video' },
  find_related:      { icon: '🔍', name: 'Find Related' },
  set_reminder:      { icon: '⏰', name: 'Set Reminder' },
  track_price:       { icon: '💰', name: 'Track Price' },
  compare_prices:    { icon: '📊', name: 'Compare Prices' },
  explain_code:      { icon: '💡', name: 'Explain Code' },
  optimize_code:     { icon: '⚡', name: 'Optimize Code' },
  smart_summary:     { icon: '📰', name: 'Smart Summary' },
  extract_keypoints: { icon: '🎯', name: 'Key Points' },
  translate_page:    { icon: '🌐', name: 'Translate' },
  read_later:        { icon: '📌', name: 'Read Later' },
  analyze_sentiment: { icon: '🧠', name: 'Sentiment' },
  deep_research:     { icon: '🔬', name: 'Deep Research' },
  generate_notes:    { icon: '📒', name: 'Study Notes' },
  check_facts:       { icon: '✅', name: 'Fact Check' }
};

// Provider presets: endpoint, default model, API format
const PROVIDER_PRESETS = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    format: 'openai'
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    format: 'openai'
  },
  moonshot: {
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    format: 'openai'
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    format: 'anthropic'
  },
  custom: {
    endpoint: '',
    model: '',
    format: 'openai'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('providerSelect');
  const endpointInput = document.getElementById('endpointInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const modelInput = document.getElementById('modelInput');
  const saveBtn = document.getElementById('saveKeyBtn');
  const configStatus = document.getElementById('configStatus');

  // Open sidebar
  document.getElementById('openSidebar').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
      window.close();
    }
  });

  // Auto-fill endpoint and model when provider preset changes
  providerSelect.addEventListener('change', () => {
    const preset = PROVIDER_PRESETS[providerSelect.value];
    if (preset) {
      endpointInput.value = preset.endpoint;
      if (preset.model) modelInput.value = preset.model;
      endpointInput.placeholder = preset.endpoint || 'https://api.openai.com/v1/chat/completions';
    }
  });

  // Save all config at once
  saveBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      configStatus.textContent = '请输入 API Key';
      configStatus.className = 'config-status error';
      return;
    }

    configStatus.textContent = '保存中...';
    configStatus.className = 'config-status';

    // Determine API format from preset
    const preset = PROVIDER_PRESETS[providerSelect.value];
    const apiFormat = preset ? preset.format : 'openai';

    // Save provider (API format: 'openai' or 'anthropic')
    await chrome.runtime.sendMessage({
      type: 'SET_PROVIDER',
      provider: apiFormat
    });

    // Save endpoint
    await chrome.runtime.sendMessage({
      type: 'SET_ENDPOINT',
      endpoint: endpointInput.value.trim()
    });

    // Save model
    const model = modelInput.value.trim();
    if (model) {
      await chrome.runtime.sendMessage({ type: 'SET_MODEL', model });
    }

    // Save API key
    const res = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: key });
    if (res.configured) {
      configStatus.textContent = 'API Key 已保存，AI 功能已启用。';
      configStatus.className = 'config-status success';
      apiKeyInput.value = '';
      apiKeyInput.placeholder = '••••••••••••  (已配置)';
      updateStatusBadge(true);
      document.getElementById('setupBanner').style.display = 'none';
    } else {
      configStatus.textContent = '保存失败。';
      configStatus.className = 'config-status error';
    }
  });

  // Load initial state
  loadStatus();
  loadStats();
});

// Detect which preset matches saved endpoint
function detectPreset(endpoint, apiProvider) {
  for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
    if (key === 'custom') continue;
    if (preset.endpoint === endpoint) return key;
  }
  if (apiProvider === 'anthropic') return 'anthropic';
  if (endpoint) return 'custom';
  return 'deepseek'; // default
}

function updateStatusBadge(configured) {
  const badge = document.getElementById('statusBadge');
  if (configured) {
    badge.textContent = 'AI Ready';
    badge.className = 'status-badge status-configured';
  } else {
    badge.textContent = '需要配置 API Key';
    badge.className = 'status-badge status-unconfigured';
  }
}

async function loadStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    updateStatusBadge(status.configured);

    if (status.configured) {
      document.getElementById('apiKeyInput').placeholder = '••••••••••••  (已配置)';
      document.getElementById('setupBanner').style.display = 'none';
    } else {
      document.getElementById('setupBanner').style.display = 'flex';
    }

    // Detect and restore preset
    const detectedPreset = detectPreset(status.apiEndpoint, status.apiProvider);
    document.getElementById('providerSelect').value = detectedPreset;

    // Restore endpoint
    if (status.apiEndpoint) {
      document.getElementById('endpointInput').value = status.apiEndpoint;
    } else {
      // Fill default endpoint from preset
      const preset = PROVIDER_PRESETS[detectedPreset];
      if (preset) {
        document.getElementById('endpointInput').value = preset.endpoint;
      }
    }

    // Restore model
    if (status.model) {
      document.getElementById('modelInput').value = status.model;
    }
  } catch {
    updateStatusBadge(false);
    document.getElementById('setupBanner').style.display = 'flex';
  }
}

async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    const history = response.history || {};

    const entries = Object.entries(history).filter(([, v]) => v.used > 0);
    const totalActions = entries.reduce((sum, [, v]) => sum + v.used, 0);
    const uniqueActions = entries.length;

    document.getElementById('totalActions').textContent = totalActions;
    document.getElementById('uniqueActions').textContent = uniqueActions;

    const listEl = document.getElementById('recentList');

    if (entries.length === 0) {
      listEl.innerHTML = '<div class="no-data">暂无操作记录。打开侧边栏开始使用！</div>';
      return;
    }

    entries.sort((a, b) => b[1].used - a[1].used);

    listEl.innerHTML = entries.slice(0, 5).map(([id, data]) => {
      const meta = ACTION_META[id] || { icon: '•', name: id };
      return `
        <div class="recent-item">
          <span class="recent-item-icon">${meta.icon}</span>
          <span class="recent-item-name">${meta.name}</span>
          <span class="recent-item-count">${data.used}x</span>
        </div>
      `;
    }).join('');
  } catch {
    document.getElementById('recentList').innerHTML =
      '<div class="no-data">无法加载统计数据。</div>';
  }
}

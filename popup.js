// ============================================================================
// Context-Aware AI Assistant v2.0 — Popup Script
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

document.addEventListener('DOMContentLoaded', () => {
  // Open sidebar
  document.getElementById('openSidebar').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
      window.close();
    }
  });

  // Save API key
  document.getElementById('saveKeyBtn').addEventListener('click', async () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) return;

    const statusEl = document.getElementById('configStatus');
    statusEl.textContent = 'Saving...';
    statusEl.className = 'config-status';

    const res = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: key });
    if (res.configured) {
      statusEl.textContent = 'API key saved successfully.';
      statusEl.className = 'config-status success';
      document.getElementById('apiKeyInput').value = '';
      document.getElementById('apiKeyInput').placeholder = '••••••••••••  (configured)';
      updateStatusBadge(true);
    } else {
      statusEl.textContent = 'Failed to save.';
      statusEl.className = 'config-status error';
    }
  });

  // Model change
  document.getElementById('modelSelect').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({ type: 'SET_MODEL', model: e.target.value });
    document.getElementById('configStatus').textContent = 'Model updated.';
    document.getElementById('configStatus').className = 'config-status success';
  });

  // Load initial state
  loadStatus();
  loadStats();
});

function updateStatusBadge(configured) {
  const badge = document.getElementById('statusBadge');
  if (configured) {
    badge.textContent = 'AI Ready';
    badge.className = 'status-badge status-configured';
  } else {
    badge.textContent = 'API Key Needed';
    badge.className = 'status-badge status-unconfigured';
  }
}

async function loadStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    updateStatusBadge(status.configured);

    if (status.configured) {
      document.getElementById('apiKeyInput').placeholder = '••••••••••••  (configured)';
    }
    if (status.model) {
      document.getElementById('modelSelect').value = status.model;
    }
  } catch {
    updateStatusBadge(false);
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
      listEl.innerHTML = '<div class="no-data">No actions used yet. Open the sidebar to get started!</div>';
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
      '<div class="no-data">Unable to load statistics.</div>';
  }
}

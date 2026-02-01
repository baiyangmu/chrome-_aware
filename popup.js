// ============================================================================
// Context-Aware AI Assistant - Popup Script
// ============================================================================

const ACTION_ICONS = {
  summarize_video: '📝',
  find_related: '🔍',
  set_reminder: '⏰',
  track_price: '💰',
  compare_prices: '📊',
  explain_code: '💡',
  optimize_code: '⚡',
  smart_summary: '📰',
  extract_keypoints: '🎯',
  translate_page: '🌐',
  read_later: '📌',
  analyze_sentiment: '🧠'
};

const ACTION_NAMES = {
  summarize_video: 'Summarize Video',
  find_related: 'Find Related',
  set_reminder: 'Set Reminder',
  track_price: 'Track Price',
  compare_prices: 'Compare Prices',
  explain_code: 'Explain Code',
  optimize_code: 'Optimize Code',
  smart_summary: 'Smart Summary',
  extract_keypoints: 'Key Points',
  translate_page: 'Translate',
  read_later: 'Read Later',
  analyze_sentiment: 'Sentiment'
};

document.addEventListener('DOMContentLoaded', () => {
  // Open sidebar button
  document.getElementById('openSidebar').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
      window.close();
    }
  });

  // Load stats
  loadStats();
});

async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    const history = response.history || {};

    const entries = Object.entries(history).filter(([, v]) => v.count > 0);
    const totalActions = entries.reduce((sum, [, v]) => sum + v.count, 0);
    const uniqueActions = entries.length;

    document.getElementById('totalActions').textContent = totalActions;
    document.getElementById('uniqueActions').textContent = uniqueActions;

    const listEl = document.getElementById('recentList');

    if (entries.length === 0) {
      listEl.innerHTML = '<div class="no-data">No actions used yet. Open the sidebar to get started!</div>';
      return;
    }

    // Sort by count descending
    entries.sort((a, b) => b[1].count - a[1].count);

    listEl.innerHTML = entries.slice(0, 5).map(([id, data]) => {
      const icon = ACTION_ICONS[id] || '•';
      const name = ACTION_NAMES[id] || id;
      return `
        <div class="recent-item">
          <span class="recent-item-icon">${icon}</span>
          <span class="recent-item-name">${name}</span>
          <span class="recent-item-count">${data.count}x</span>
        </div>
      `;
    }).join('');
  } catch {
    // Extension context may not be available
    document.getElementById('recentList').innerHTML =
      '<div class="no-data">Unable to load statistics.</div>';
  }
}

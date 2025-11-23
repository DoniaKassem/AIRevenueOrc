/**
 * AIRevenueOrc Popup Script
 */

// Initialize popup
async function initialize() {
  // Check authentication status
  const response = await chrome.runtime.sendMessage({
    type: 'GET_AUTH_STATUS'
  });

  updateStatus(response);

  // Setup event listeners
  setupEventListeners();
}

/**
 * Update status display
 */
function updateStatus(authStatus) {
  const statusElement = document.getElementById('connection-status');
  const userEmailElement = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');

  if (authStatus.authenticated) {
    statusElement.textContent = 'Connected';
    statusElement.className = 'status-value status-connected';
    userEmailElement.textContent = authStatus.user?.email || '-';
    logoutBtn.style.display = 'block';
  } else {
    statusElement.textContent = 'Not Connected';
    statusElement.className = 'status-value status-disconnected';
    userEmailElement.textContent = '-';
    logoutBtn.style.display = 'none';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('open-dashboard-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.airevenueorc.com' });
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://app.airevenueorc.com/settings' });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({
      type: 'LOGOUT'
    });

    if (response.success) {
      updateStatus({ authenticated: false });
    }
  });
}

// Initialize on load
initialize();

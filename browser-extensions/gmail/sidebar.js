/**
 * AIRevenueOrc Sidebar Script
 */

// State
let currentProspect = null;
let authenticated = false;

/**
 * Initialize sidebar
 */
async function initialize() {
  console.log('[AIRevenueOrc Sidebar] Initializing');

  // Check authentication status
  const authStatus = await chrome.runtime.sendMessage({
    type: 'GET_AUTH_STATUS'
  });

  authenticated = authStatus.authenticated;

  if (authenticated) {
    showState('loading');
  } else {
    showState('not-authenticated');
  }

  // Setup event listeners
  setupEventListeners();

  // Listen for messages from content script
  window.addEventListener('message', handleMessage);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Auth form
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }

  // Create prospect button
  const createProspectBtn = document.getElementById('create-prospect-btn');
  if (createProspectBtn) {
    createProspectBtn.addEventListener('click', handleCreateProspect);
  }

  // View full profile button
  const viewProfileBtn = document.getElementById('view-full-profile-btn');
  if (viewProfileBtn) {
    viewProfileBtn.addEventListener('click', handleViewProfile);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefresh);
  }
}

/**
 * Handle authentication form submit
 */
async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;

  const response = await chrome.runtime.sendMessage({
    type: 'AUTHENTICATE',
    data: { email, password }
  });

  if (response.success) {
    authenticated = true;
    showState('loading');
    hideError();
  } else {
    showError(response.error || 'Authentication failed');
  }
}

/**
 * Handle message from content script
 */
function handleMessage(event) {
  if (event.data.type === 'UPDATE_DATA') {
    updateData(event.data.data);
  }
}

/**
 * Update sidebar with new data
 */
async function updateData(data) {
  console.log('[AIRevenueOrc Sidebar] Updating data', data);

  if (data.noProspect) {
    // No prospect found
    document.getElementById('current-email-display').textContent = data.email?.from || '';
    showState('no-prospect');
  } else if (data.prospect) {
    // Prospect found
    currentProspect = data.prospect;
    await displayProspect(data.prospect);
    showState('prospect');
  }
}

/**
 * Display prospect information
 */
async function displayProspect(prospect) {
  // Header
  const initials = getInitials(prospect.first_name, prospect.last_name);
  document.getElementById('prospect-initials').textContent = initials;
  document.getElementById('prospect-name').textContent =
    `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
  document.getElementById('prospect-title').textContent = prospect.title || '-';
  document.getElementById('prospect-company').textContent = prospect.company || '-';

  // Contact details
  document.getElementById('prospect-email').textContent = prospect.email || '-';
  document.getElementById('prospect-phone').textContent = prospect.phone || '-';

  // Status
  document.getElementById('prospect-stage').textContent = prospect.stage || '-';
  document.getElementById('prospect-score').textContent =
    prospect.score ? `${prospect.score}/100` : '-';

  // Load context (activities and opportunities)
  await loadProspectContext(prospect.id);
}

/**
 * Load prospect context (recent activities, opportunities)
 */
async function loadProspectContext(prospectId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PROSPECT_CONTEXT',
      data: { prospectId }
    });

    if (response.success) {
      displayActivities(response.context.activities || []);
      displayOpportunities(response.context.opportunities || []);
    }
  } catch (error) {
    console.error('[AIRevenueOrc Sidebar] Error loading context:', error);
  }
}

/**
 * Display recent activities
 */
function displayActivities(activities) {
  const container = document.getElementById('recent-activities');

  if (activities.length === 0) {
    container.innerHTML = '<p class="loading-text">No recent activities</p>';
    return;
  }

  container.innerHTML = activities.slice(0, 5).map(activity => `
    <div class="activity-item">
      <div class="activity-type">${activity.activity_type}</div>
      <div class="activity-content">${activity.notes || activity.subject || '-'}</div>
      <div class="activity-time">${formatDate(activity.completed_at || activity.created_at)}</div>
    </div>
  `).join('');
}

/**
 * Display opportunities
 */
function displayOpportunities(opportunities) {
  const container = document.getElementById('opportunities');

  if (opportunities.length === 0) {
    container.innerHTML = '<p class="loading-text">No opportunities</p>';
    return;
  }

  container.innerHTML = opportunities.map(opp => `
    <div class="opportunity-item">
      <div class="opportunity-name">${opp.name}</div>
      <div class="opportunity-details">
        <span>${opp.stage}</span>
        <span>$${formatNumber(opp.amount || 0)}</span>
      </div>
    </div>
  `).join('');
}

/**
 * Handle create prospect
 */
function handleCreateProspect() {
  const email = document.getElementById('current-email-display').textContent;
  // Open AIRevenueOrc in new tab with create prospect form
  window.open(`https://app.airevenueorc.com/prospects/new?email=${encodeURIComponent(email)}`, '_blank');
}

/**
 * Handle view full profile
 */
function handleViewProfile() {
  if (!currentProspect) return;
  window.open(`https://app.airevenueorc.com/prospects/${currentProspect.id}`, '_blank');
}

/**
 * Handle refresh
 */
async function handleRefresh() {
  if (!currentProspect) return;

  showState('loading');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_PROSPECT',
      data: { prospectId: currentProspect.id }
    });

    if (response.success) {
      currentProspect = response.prospect;
      await displayProspect(response.prospect);
      showState('prospect');
    }
  } catch (error) {
    console.error('[AIRevenueOrc Sidebar] Error refreshing:', error);
  }
}

/**
 * Show specific state
 */
function showState(stateName) {
  const states = ['loading', 'not-authenticated', 'no-prospect', 'prospect'];

  states.forEach(state => {
    const element = document.getElementById(`${state}-state`);
    if (element) {
      element.style.display = state === stateName ? 'block' : 'none';
    }
  });
}

/**
 * Show error message
 */
function showError(message) {
  const errorElement = document.getElementById('auth-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

/**
 * Hide error message
 */
function hideError() {
  const errorElement = document.getElementById('auth-error');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}

/**
 * Get initials from name
 */
function getInitials(firstName, lastName) {
  const first = (firstName || '').charAt(0).toUpperCase();
  const last = (lastName || '').charAt(0).toUpperCase();
  return first + last || '?';
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Initialize on load
initialize();

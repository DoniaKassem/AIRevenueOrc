/**
 * AIRevenueOrc Outlook Add-in - Task Pane Script
 */

const API_BASE_URL = 'https://app.airevenueorc.com/api';

// State
let currentProspect = null;
let authenticated = false;
let authToken = null;

/**
 * Initialize Office add-in
 */
Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    console.log('[AIRevenueOrc] Outlook add-in initialized');
    initialize();
  }
});

/**
 * Initialize task pane
 */
async function initialize() {
  // Load saved auth token
  await loadAuthToken();

  if (authenticated) {
    showState('loading');
    await loadEmailContext();
  } else {
    showState('not-authenticated');
  }

  // Setup event listeners
  setupEventListeners();
}

/**
 * Load auth token from Office storage
 */
async function loadAuthToken() {
  return new Promise((resolve) => {
    Office.context.roamingSettings.loadAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        authToken = Office.context.roamingSettings.get('authToken');
        const user = Office.context.roamingSettings.get('currentUser');

        if (authToken) {
          authenticated = true;
          console.log('[AIRevenueOrc] Loaded auth token');
        }
      }
      resolve();
    });
  });
}

/**
 * Save auth token to Office storage
 */
async function saveAuthToken(token, user) {
  return new Promise((resolve) => {
    Office.context.roamingSettings.set('authToken', token);
    Office.context.roamingSettings.set('currentUser', user);
    Office.context.roamingSettings.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        console.log('[AIRevenueOrc] Saved auth token');
      }
      resolve();
    });
  });
}

/**
 * Clear auth token from Office storage
 */
async function clearAuthToken() {
  return new Promise((resolve) => {
    Office.context.roamingSettings.remove('authToken');
    Office.context.roamingSettings.remove('currentUser');
    Office.context.roamingSettings.saveAsync((result) => {
      resolve();
    });
  });
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

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const result = await response.json();
    authToken = result.token;

    await saveAuthToken(result.token, result.user);

    authenticated = true;
    hideError();
    showState('loading');
    await loadEmailContext();
  } catch (error) {
    console.error('[AIRevenueOrc] Authentication error:', error);
    showError(error.message || 'Authentication failed');
  }
}

/**
 * Load email context from current message
 */
async function loadEmailContext() {
  try {
    const item = Office.context.mailbox.item;

    // Get sender email
    let senderEmail = null;

    if (item.itemType === Office.MailboxEnums.ItemType.Message) {
      // Reading a message
      if (item.from) {
        senderEmail = item.from.emailAddress;
      }
    } else if (item.itemType === Office.MailboxEnums.ItemType.Appointment) {
      // Meeting
      if (item.organizer) {
        senderEmail = item.organizer.emailAddress;
      }
    }

    // If composing, get "to" recipients
    if (item.to && item.to.length > 0) {
      senderEmail = item.to[0].emailAddress;
    }

    if (!senderEmail) {
      showState('no-prospect');
      return;
    }

    // Search for prospect
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prospects/search?email=${encodeURIComponent(senderEmail)}`
    );

    const prospects = await response.json();

    if (prospects.length > 0) {
      currentProspect = prospects[0];
      await displayProspect(currentProspect);
      showState('prospect');
    } else {
      document.getElementById('current-email-display').textContent = senderEmail;
      showState('no-prospect');
    }
  } catch (error) {
    console.error('[AIRevenueOrc] Error loading email context:', error);

    if (error.message === 'Not authenticated') {
      authenticated = false;
      authToken = null;
      await clearAuthToken();
      showState('not-authenticated');
    }
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
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prospects/${prospectId}/context`
    );

    const context = await response.json();

    displayActivities(context.activities || []);
    displayOpportunities(context.opportunities || []);
  } catch (error) {
    console.error('[AIRevenueOrc] Error loading context:', error);
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
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prospects/${currentProspect.id}`
    );

    currentProspect = await response.json();
    await displayProspect(currentProspect);
    showState('prospect');
  } catch (error) {
    console.error('[AIRevenueOrc] Error refreshing:', error);
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
 * Make authenticated fetch request
 */
async function authenticatedFetch(url, options = {}) {
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      ...options.headers
    }
  };

  const response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    // Token expired
    throw new Error('Not authenticated');
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response;
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

/**
 * AIRevenueOrc Gmail Extension - Background Service Worker
 * Handles authentication, API communication, and extension state
 */

const API_BASE_URL = 'https://app.airevenueorc.com/api'; // Configure based on environment

// Extension state
let authToken = null;
let currentUser = null;

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AIRevenueOrc] Extension installed');

  // Load saved auth token
  const result = await chrome.storage.local.get(['authToken', 'currentUser']);
  if (result.authToken) {
    authToken = result.authToken;
    currentUser = result.currentUser;
  }
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AIRevenueOrc] Message received:', message.type);

  switch (message.type) {
    case 'GET_AUTH_STATUS':
      handleGetAuthStatus(sendResponse);
      return true;

    case 'AUTHENTICATE':
      handleAuthenticate(message.data, sendResponse);
      return true;

    case 'LOGOUT':
      handleLogout(sendResponse);
      return true;

    case 'SEARCH_PROSPECT':
      handleSearchProspect(message.data, sendResponse);
      return true;

    case 'GET_PROSPECT':
      handleGetProspect(message.data, sendResponse);
      return true;

    case 'LOG_EMAIL':
      handleLogEmail(message.data, sendResponse);
      return true;

    case 'GET_TEMPLATES':
      handleGetTemplates(sendResponse);
      return true;

    case 'GET_TEMPLATE':
      handleGetTemplate(message.data, sendResponse);
      return true;

    case 'TRACK_EMAIL':
      handleTrackEmail(message.data, sendResponse);
      return true;

    case 'GET_PROSPECT_CONTEXT':
      handleGetProspectContext(message.data, sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
});

/**
 * Get authentication status
 */
async function handleGetAuthStatus(sendResponse) {
  sendResponse({
    authenticated: !!authToken,
    user: currentUser
  });
}

/**
 * Authenticate user
 */
async function handleAuthenticate(data, sendResponse) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password
      })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const result = await response.json();

    authToken = result.token;
    currentUser = result.user;

    // Save to storage
    await chrome.storage.local.set({
      authToken: authToken,
      currentUser: currentUser
    });

    sendResponse({
      success: true,
      user: currentUser
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Authentication error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Logout user
 */
async function handleLogout(sendResponse) {
  authToken = null;
  currentUser = null;

  await chrome.storage.local.remove(['authToken', 'currentUser']);

  sendResponse({ success: true });
}

/**
 * Search for prospect by email
 */
async function handleSearchProspect(data, sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prospects/search?email=${encodeURIComponent(data.email)}`
    );

    const prospects = await response.json();

    sendResponse({
      success: true,
      prospects: prospects
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Search prospect error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get prospect by ID
 */
async function handleGetProspect(data, sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prospects/${data.prospectId}`
    );

    const prospect = await response.json();

    sendResponse({
      success: true,
      prospect: prospect
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Get prospect error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Log email to CRM
 */
async function handleLogEmail(data, sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/activities/log-email`,
      {
        method: 'POST',
        body: JSON.stringify({
          prospectId: data.prospectId,
          subject: data.subject,
          body: data.body,
          direction: data.direction, // 'outbound' or 'inbound'
          sentAt: data.sentAt,
          metadata: {
            messageId: data.messageId,
            threadId: data.threadId
          }
        })
      }
    );

    const result = await response.json();

    sendResponse({
      success: true,
      activity: result
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Log email error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get email templates
 */
async function handleGetTemplates(sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/templates?type=email`
    );

    const templates = await response.json();

    sendResponse({
      success: true,
      templates: templates
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Get templates error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get specific template
 */
async function handleGetTemplate(data, sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/templates/${data.templateId}`
    );

    const template = await response.json();

    sendResponse({
      success: true,
      template: template
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Get template error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Enable tracking for email
 */
async function handleTrackEmail(data, sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/email/tracking/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          prospectId: data.prospectId,
          emailBody: data.emailBody
        })
      }
    );

    const trackingData = await response.json();

    sendResponse({
      success: true,
      trackingData: trackingData
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Track email error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get prospect context (recent activities, opportunities, etc.)
 */
async function handleGetProspectContext(data, sendResponse) {
  try {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/prospects/${data.prospectId}/context`
    );

    const context = await response.json();

    sendResponse({
      success: true,
      context: context
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Get prospect context error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Helper: Make authenticated fetch request
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
    // Token expired, clear auth
    authToken = null;
    currentUser = null;
    await chrome.storage.local.remove(['authToken', 'currentUser']);
    throw new Error('Authentication expired');
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response;
}

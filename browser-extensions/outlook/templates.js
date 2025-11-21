/**
 * AIRevenueOrc Outlook Add-in - Templates
 */

const API_BASE_URL = 'https://app.airevenueorc.com/api';

let authToken = null;
let currentProspect = null;

/**
 * Initialize Office add-in
 */
Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    console.log('[AIRevenueOrc Templates] Initialized');
    initialize();
  }
});

/**
 * Initialize templates page
 */
async function initialize() {
  // Load auth token
  await loadAuthToken();

  if (!authToken) {
    showError('Not authenticated. Please sign in to AIRevenueOrc first.');
    return;
  }

  // Load current prospect (from recipient)
  await loadCurrentProspect();

  // Load templates
  await loadTemplates();
}

/**
 * Load auth token from Office storage
 */
async function loadAuthToken() {
  return new Promise((resolve) => {
    Office.context.roamingSettings.loadAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        authToken = Office.context.roamingSettings.get('authToken');
      }
      resolve();
    });
  });
}

/**
 * Load current prospect from recipient
 */
async function loadCurrentProspect() {
  try {
    const item = Office.context.mailbox.item;

    if (!item.to || item.to.length === 0) {
      return;
    }

    const recipientEmail = item.to[0].emailAddress;

    // Search for prospect
    const response = await fetch(
      `${API_BASE_URL}/prospects/search?email=${encodeURIComponent(recipientEmail)}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const prospects = await response.json();
      if (prospects.length > 0) {
        currentProspect = prospects[0];
        console.log('[AIRevenueOrc Templates] Loaded prospect:', currentProspect.email);
      }
    }
  } catch (error) {
    console.error('[AIRevenueOrc Templates] Error loading prospect:', error);
  }
}

/**
 * Load templates from API
 */
async function loadTemplates() {
  try {
    const response = await fetch(`${API_BASE_URL}/templates?type=email`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load templates');
    }

    const templates = await response.json();

    hideLoading();

    if (templates.length === 0) {
      showEmptyState();
    } else {
      displayTemplates(templates);
    }
  } catch (error) {
    console.error('[AIRevenueOrc Templates] Error loading templates:', error);
    hideLoading();
    showError(error.message || 'Failed to load templates');
  }
}

/**
 * Display templates list
 */
function displayTemplates(templates) {
  const container = document.getElementById('templates-container');

  container.innerHTML = templates.map(template => `
    <div class="template-item" data-template-id="${template.id}">
      <div class="template-name">${template.name}</div>
      <div class="template-description">${template.description || ''}</div>
    </div>
  `).join('');

  // Add click listeners
  container.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', () => {
      const templateId = item.dataset.templateId;
      insertTemplate(templateId);
    });
  });

  container.style.display = 'flex';
}

/**
 * Insert template into email
 */
async function insertTemplate(templateId) {
  try {
    // Get template
    const response = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load template');
    }

    const template = await response.json();

    // Replace variables
    let content = template.content;
    let subject = template.subject || '';

    if (currentProspect) {
      content = replaceVariables(content, currentProspect);
      subject = replaceVariables(subject, currentProspect);
    }

    // Insert into email
    const item = Office.context.mailbox.item;

    // Set subject
    if (subject) {
      item.subject.setAsync(subject, (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          console.error('[AIRevenueOrc Templates] Failed to set subject');
        }
      });
    }

    // Set body
    item.body.setAsync(content, { coercionType: Office.CoercionType.Html }, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        console.log('[AIRevenueOrc Templates] Template inserted successfully');
        // Close task pane
        Office.context.ui.closeContainer();
      } else {
        showError('Failed to insert template');
      }
    });
  } catch (error) {
    console.error('[AIRevenueOrc Templates] Error inserting template:', error);
    showError(error.message || 'Failed to insert template');
  }
}

/**
 * Replace variables in template
 */
function replaceVariables(text, prospect) {
  return text
    .replace(/{{firstName}}/g, prospect.first_name || '')
    .replace(/{{lastName}}/g, prospect.last_name || '')
    .replace(/{{company}}/g, prospect.company || '')
    .replace(/{{email}}/g, prospect.email || '')
    .replace(/{{title}}/g, prospect.title || '')
    .replace(/{{phone}}/g, prospect.phone || '');
}

/**
 * Show error message
 */
function showError(message) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

/**
 * Show empty state
 */
function showEmptyState() {
  document.getElementById('empty-state').style.display = 'block';
}

/**
 * AIRevenueOrc Gmail Extension - Content Script
 * Injects sidebar and integrates with Gmail UI
 */

// State
let sidebarInjected = false;
let currentEmail = null;
let currentProspect = null;

/**
 * Initialize content script
 */
function initialize() {
  console.log('[AIRevenueOrc] Content script initialized');

  // Wait for Gmail to load
  waitForGmail(() => {
    console.log('[AIRevenueOrc] Gmail loaded, injecting sidebar');
    injectSidebar();
    observeEmailChanges();
    injectComposeTools();
  });
}

/**
 * Wait for Gmail to be fully loaded
 */
function waitForGmail(callback) {
  const checkInterval = setInterval(() => {
    // Check if Gmail's main view is loaded
    const mainView = document.querySelector('.AO');
    if (mainView) {
      clearInterval(checkInterval);
      callback();
    }
  }, 500);
}

/**
 * Inject sidebar into Gmail UI
 */
function injectSidebar() {
  if (sidebarInjected) return;

  // Create sidebar container
  const sidebar = document.createElement('div');
  sidebar.id = 'airevenueorc-sidebar';
  sidebar.className = 'airevenueorc-sidebar';

  // Create iframe for sidebar content
  const iframe = document.createElement('iframe');
  iframe.id = 'airevenueorc-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';

  sidebar.appendChild(iframe);

  // Find Gmail's right sidebar and insert ours
  const gmailRightSidebar = document.querySelector('.bkL');
  if (gmailRightSidebar) {
    gmailRightSidebar.parentNode.insertBefore(sidebar, gmailRightSidebar.nextSibling);
    sidebarInjected = true;
  }
}

/**
 * Observe email changes in Gmail
 */
function observeEmailChanges() {
  // Monitor email view changes
  const observer = new MutationObserver((mutations) => {
    // Check if email view changed
    const emailView = document.querySelector('.nH.aHU');
    if (emailView) {
      extractEmailDetails();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also check on navigation events
  window.addEventListener('hashchange', () => {
    setTimeout(extractEmailDetails, 500);
  });
}

/**
 * Extract email details from current Gmail view
 */
async function extractEmailDetails() {
  try {
    // Extract sender email
    const senderElement = document.querySelector('.gD');
    if (!senderElement) return;

    const senderEmail = senderElement.getAttribute('email');
    if (!senderEmail || senderEmail === currentEmail) return;

    currentEmail = senderEmail;

    // Extract other details
    const subjectElement = document.querySelector('.hP');
    const subject = subjectElement ? subjectElement.textContent : '';

    // Search for prospect
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_PROSPECT',
      data: { email: senderEmail }
    });

    if (response.success && response.prospects.length > 0) {
      currentProspect = response.prospects[0];

      // Update sidebar with prospect info
      updateSidebar({
        prospect: currentProspect,
        email: {
          subject: subject,
          from: senderEmail
        }
      });
    } else {
      // No prospect found
      updateSidebar({
        email: {
          subject: subject,
          from: senderEmail
        },
        noProspect: true
      });
    }
  } catch (error) {
    console.error('[AIRevenueOrc] Error extracting email details:', error);
  }
}

/**
 * Update sidebar with new data
 */
function updateSidebar(data) {
  const iframe = document.getElementById('airevenueorc-sidebar-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'UPDATE_DATA',
      data: data
    }, '*');
  }
}

/**
 * Inject compose tools into Gmail compose windows
 */
function injectComposeTools() {
  // Observer for compose windows
  const observer = new MutationObserver((mutations) => {
    const composeWindows = document.querySelectorAll('.M9');
    composeWindows.forEach((composeWindow) => {
      if (!composeWindow.querySelector('.airevenueorc-compose-toolbar')) {
        injectComposeToolbar(composeWindow);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Inject toolbar into compose window
 */
function injectComposeToolbar(composeWindow) {
  // Find compose toolbar
  const composeToolbar = composeWindow.querySelector('.gU');
  if (!composeToolbar) return;

  // Create our toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'airevenueorc-compose-toolbar';
  toolbar.innerHTML = `
    <button class="airevenueorc-btn" id="airevenueorc-templates-btn" title="Insert Template">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2z"/>
      </svg>
      Templates
    </button>
    <button class="airevenueorc-btn" id="airevenueorc-tracking-btn" title="Enable Tracking">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 10a4 4 0 110-8 4 4 0 010 8z"/>
      </svg>
      Track
    </button>
    <button class="airevenueorc-btn" id="airevenueorc-log-btn" title="Log to CRM">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h12v2H2v-2zm0 4h12v2H2v-2z"/>
      </svg>
      Log
    </button>
  `;

  composeToolbar.appendChild(toolbar);

  // Add event listeners
  toolbar.querySelector('#airevenueorc-templates-btn').addEventListener('click', () => {
    showTemplatesModal(composeWindow);
  });

  toolbar.querySelector('#airevenueorc-tracking-btn').addEventListener('click', () => {
    toggleTracking(composeWindow);
  });

  toolbar.querySelector('#airevenueorc-log-btn').addEventListener('click', () => {
    logEmail(composeWindow);
  });
}

/**
 * Show templates modal
 */
async function showTemplatesModal(composeWindow) {
  try {
    // Get templates from background
    const response = await chrome.runtime.sendMessage({
      type: 'GET_TEMPLATES'
    });

    if (!response.success) {
      alert('Failed to load templates');
      return;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'airevenueorc-modal';
    modal.innerHTML = `
      <div class="airevenueorc-modal-content">
        <div class="airevenueorc-modal-header">
          <h3>Select Template</h3>
          <button class="airevenueorc-modal-close">&times;</button>
        </div>
        <div class="airevenueorc-modal-body">
          <div class="airevenueorc-templates-list">
            ${response.templates.map(template => `
              <div class="airevenueorc-template-item" data-template-id="${template.id}">
                <h4>${template.name}</h4>
                <p>${template.description || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.airevenueorc-modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelectorAll('.airevenueorc-template-item').forEach(item => {
      item.addEventListener('click', async () => {
        const templateId = item.dataset.templateId;
        await insertTemplate(composeWindow, templateId);
        modal.remove();
      });
    });
  } catch (error) {
    console.error('[AIRevenueOrc] Error showing templates:', error);
  }
}

/**
 * Insert template into compose window
 */
async function insertTemplate(composeWindow, templateId) {
  try {
    // Get template content
    const response = await chrome.runtime.sendMessage({
      type: 'GET_TEMPLATE',
      data: { templateId: templateId }
    });

    if (!response.success) {
      alert('Failed to load template');
      return;
    }

    // Find compose body
    const composeBody = composeWindow.querySelector('[contenteditable="true"]');
    if (!composeBody) return;

    // Insert template content
    const template = response.template;

    // Simple variable replacement
    let content = template.content;
    if (currentProspect) {
      content = content
        .replace(/{{firstName}}/g, currentProspect.first_name || '')
        .replace(/{{lastName}}/g, currentProspect.last_name || '')
        .replace(/{{company}}/g, currentProspect.company || '')
        .replace(/{{email}}/g, currentProspect.email || '');
    }

    // Insert into compose window
    composeBody.innerHTML = content;

    // Also update subject if template has one
    if (template.subject) {
      const subjectField = composeWindow.querySelector('input[name="subjectbox"]');
      if (subjectField) {
        let subject = template.subject;
        if (currentProspect) {
          subject = subject
            .replace(/{{firstName}}/g, currentProspect.first_name || '')
            .replace(/{{company}}/g, currentProspect.company || '');
        }
        subjectField.value = subject;
      }
    }
  } catch (error) {
    console.error('[AIRevenueOrc] Error inserting template:', error);
  }
}

/**
 * Toggle email tracking
 */
function toggleTracking(composeWindow) {
  const trackingBtn = composeWindow.querySelector('#airevenueorc-tracking-btn');
  const isEnabled = trackingBtn.classList.contains('active');

  if (isEnabled) {
    trackingBtn.classList.remove('active');
    composeWindow.dataset.tracking = 'false';
  } else {
    trackingBtn.classList.add('active');
    composeWindow.dataset.tracking = 'true';
  }
}

/**
 * Log email to CRM
 */
async function logEmail(composeWindow) {
  try {
    // Extract email details
    const toField = composeWindow.querySelector('input[name="to"]');
    const subjectField = composeWindow.querySelector('input[name="subjectbox"]');
    const bodyField = composeWindow.querySelector('[contenteditable="true"]');

    if (!toField || !subjectField || !bodyField) {
      alert('Could not extract email details');
      return;
    }

    const to = toField.value;
    const subject = subjectField.value;
    const body = bodyField.innerHTML;

    // Search for prospect
    const searchResponse = await chrome.runtime.sendMessage({
      type: 'SEARCH_PROSPECT',
      data: { email: to }
    });

    if (!searchResponse.success || searchResponse.prospects.length === 0) {
      alert('No prospect found for this email');
      return;
    }

    const prospect = searchResponse.prospects[0];

    // Log email
    const logResponse = await chrome.runtime.sendMessage({
      type: 'LOG_EMAIL',
      data: {
        prospectId: prospect.id,
        subject: subject,
        body: body,
        direction: 'outbound',
        sentAt: new Date().toISOString()
      }
    });

    if (logResponse.success) {
      alert('Email logged successfully!');
    } else {
      alert('Failed to log email');
    }
  } catch (error) {
    console.error('[AIRevenueOrc] Error logging email:', error);
    alert('Error logging email');
  }
}

// Initialize
initialize();

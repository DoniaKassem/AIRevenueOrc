/**
 * AIRevenueOrc Outlook Add-in - Commands
 * Handles button click actions
 */

const API_BASE_URL = 'https://app.airevenueorc.com/api';

let authToken = null;

/**
 * Initialize Office add-in
 */
Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    console.log('[AIRevenueOrc Commands] Initialized');
    loadAuthToken();
  }
});

/**
 * Load auth token from Office storage
 */
function loadAuthToken() {
  Office.context.roamingSettings.loadAsync((result) => {
    if (result.status === Office.AsyncResultStatus.Succeeded) {
      authToken = Office.context.roamingSettings.get('authToken');
      console.log('[AIRevenueOrc Commands] Auth token loaded:', !!authToken);
    }
  });
}

/**
 * Log email to CRM
 */
function logEmail(event) {
  console.log('[AIRevenueOrc] Log email command triggered');

  if (!authToken) {
    showNotification('Not authenticated', 'Please sign in to AIRevenueOrc first');
    event.completed();
    return;
  }

  const item = Office.context.mailbox.item;

  // Get email details
  let senderEmail = null;
  let direction = 'inbound';

  if (item.itemType === Office.MailboxEnums.ItemType.Message) {
    if (item.from) {
      senderEmail = item.from.emailAddress;
      direction = 'inbound';
    }
  }

  // If no sender (composing), get "to" recipients
  if (!senderEmail && item.to && item.to.length > 0) {
    senderEmail = item.to[0].emailAddress;
    direction = 'outbound';
  }

  if (!senderEmail) {
    showNotification('Error', 'Could not determine email recipient');
    event.completed();
    return;
  }

  // Get subject and body
  item.subject.getAsync((subjectResult) => {
    if (subjectResult.status !== Office.AsyncResultStatus.Succeeded) {
      showNotification('Error', 'Could not read email subject');
      event.completed();
      return;
    }

    const subject = subjectResult.value;

    item.body.getAsync(Office.CoercionType.Html, (bodyResult) => {
      if (bodyResult.status !== Office.AsyncResultStatus.Succeeded) {
        showNotification('Error', 'Could not read email body');
        event.completed();
        return;
      }

      const body = bodyResult.value;

      // Search for prospect and log email
      logEmailToAPI(senderEmail, subject, body, direction, event);
    });
  });
}

/**
 * Log email to API
 */
async function logEmailToAPI(email, subject, body, direction, event) {
  try {
    // Search for prospect
    const searchResponse = await fetch(
      `${API_BASE_URL}/prospects/search?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for prospect');
    }

    const prospects = await searchResponse.json();

    if (prospects.length === 0) {
      showNotification('No prospect found', `No prospect found for ${email}`);
      event.completed();
      return;
    }

    const prospect = prospects[0];

    // Log email
    const logResponse = await fetch(`${API_BASE_URL}/activities/log-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prospectId: prospect.id,
        subject: subject,
        body: body,
        direction: direction,
        sentAt: new Date().toISOString()
      })
    });

    if (!logResponse.ok) {
      throw new Error('Failed to log email');
    }

    showNotification('Success', 'Email logged to AIRevenueOrc');
  } catch (error) {
    console.error('[AIRevenueOrc] Error logging email:', error);
    showNotification('Error', error.message || 'Failed to log email');
  } finally {
    event.completed();
  }
}

/**
 * Enable tracking for email
 */
function enableTracking(event) {
  console.log('[AIRevenueOrc] Enable tracking command triggered');

  if (!authToken) {
    showNotification('Not authenticated', 'Please sign in to AIRevenueOrc first');
    event.completed();
    return;
  }

  const item = Office.context.mailbox.item;

  // Get recipient email
  if (!item.to || item.to.length === 0) {
    showNotification('Error', 'Please add a recipient first');
    event.completed();
    return;
  }

  const recipientEmail = item.to[0].emailAddress;

  // Get email body
  item.body.getAsync(Office.CoercionType.Html, async (bodyResult) => {
    if (bodyResult.status !== Office.AsyncResultStatus.Succeeded) {
      showNotification('Error', 'Could not read email body');
      event.completed();
      return;
    }

    const body = bodyResult.value;

    try {
      // Search for prospect
      const searchResponse = await fetch(
        `${API_BASE_URL}/prospects/search?email=${encodeURIComponent(recipientEmail)}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Failed to search for prospect');
      }

      const prospects = await searchResponse.json();

      if (prospects.length === 0) {
        showNotification('No prospect found', `No prospect found for ${recipientEmail}`);
        event.completed();
        return;
      }

      const prospect = prospects[0];

      // Generate tracking data
      const trackingResponse = await fetch(`${API_BASE_URL}/email/tracking/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prospectId: prospect.id,
          emailBody: body
        })
      });

      if (!trackingResponse.ok) {
        throw new Error('Failed to generate tracking data');
      }

      const trackingData = await trackingResponse.json();

      // Inject tracking into email body
      let trackedBody = body;

      // Replace links with tracking URLs
      if (trackingData.linkTrackingUrls) {
        for (const [originalUrl, trackedUrl] of Object.entries(trackingData.linkTrackingUrls)) {
          trackedBody = trackedBody.replace(
            new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            trackedUrl
          );
        }
      }

      // Add tracking pixel before </body>
      if (trackingData.openTrackingUrl) {
        const trackingPixel = `<img src="${trackingData.openTrackingUrl}" width="1" height="1" style="display:none;" />`;
        trackedBody = trackedBody.replace('</body>', `${trackingPixel}</body>`);
      }

      // Update email body
      item.body.setAsync(trackedBody, { coercionType: Office.CoercionType.Html }, (setResult) => {
        if (setResult.status === Office.AsyncResultStatus.Succeeded) {
          showNotification('Success', 'Email tracking enabled');
        } else {
          showNotification('Error', 'Failed to update email body');
        }
        event.completed();
      });
    } catch (error) {
      console.error('[AIRevenueOrc] Error enabling tracking:', error);
      showNotification('Error', error.message || 'Failed to enable tracking');
      event.completed();
    }
  });
}

/**
 * Show notification
 */
function showNotification(title, message) {
  Office.context.mailbox.item.notificationMessages.addAsync('airevenueorc-notification', {
    type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
    message: `${title}: ${message}`,
    icon: 'icon-16',
    persistent: false
  });
}

/**
 * Register functions
 */
Office.actions.associate('logEmail', logEmail);
Office.actions.associate('enableTracking', enableTracking);

# AIRevenueOrc for Gmail

Chrome extension that integrates AIRevenueOrc with Gmail for seamless sales engagement.

## Features

### Prospect Context Sidebar
- Displays prospect information for the current email
- Shows recent activities and opportunities
- Real-time updates when switching emails
- Quick access to full prospect profile

### Email Compose Integration
- **Templates**: Insert pre-built email templates with variable substitution
- **Tracking**: Enable open and click tracking for outbound emails
- **CRM Logging**: Automatically log emails to AIRevenueOrc

### Template Variables
Supported template variables:
- `{{firstName}}` - Prospect's first name
- `{{lastName}}` - Prospect's last name
- `{{company}}` - Prospect's company
- `{{email}}` - Prospect's email

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `browser-extensions/gmail` directory

### Production Build

```bash
# Build extension
cd browser-extensions/gmail
npm run build

# Package for Chrome Web Store
npm run package
```

## Usage

### Authentication

1. Click the AIRevenueOrc extension icon
2. Sign in with your AIRevenueOrc credentials
3. The extension will sync with your account

### Viewing Prospect Context

1. Open any email in Gmail
2. The sidebar will automatically display prospect information
3. If no prospect is found, you can create one directly

### Using Templates

1. Open a compose window
2. Click the "Templates" button in the compose toolbar
3. Select a template from the list
4. Variables will be automatically replaced with prospect data

### Enabling Email Tracking

1. Open a compose window
2. Click the "Track" button to enable tracking
3. The button will turn blue when enabled
4. Opens and clicks will be logged in AIRevenueOrc

### Logging Emails

1. Compose your email
2. Click the "Log" button
3. The email will be saved as an activity in AIRevenueOrc

## Architecture

### Files

- `manifest.json` - Extension configuration (Manifest V3)
- `background.js` - Service worker for API communication and authentication
- `content.js` - Content script injected into Gmail pages
- `content.css` - Styles for injected elements
- `sidebar.html` - Sidebar UI template
- `sidebar.js` - Sidebar logic and rendering
- `sidebar.css` - Sidebar styles
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic

### Communication Flow

```
Gmail Page
    ↓
Content Script (content.js)
    ↓
Background Service Worker (background.js)
    ↓
AIRevenueOrc API
```

### Message Types

**GET_AUTH_STATUS**: Check if user is authenticated
**AUTHENTICATE**: Sign in user
**LOGOUT**: Sign out user
**SEARCH_PROSPECT**: Find prospect by email
**GET_PROSPECT**: Get prospect by ID
**LOG_EMAIL**: Log email as activity
**GET_TEMPLATES**: Get all email templates
**GET_TEMPLATE**: Get specific template
**TRACK_EMAIL**: Enable tracking for email
**GET_PROSPECT_CONTEXT**: Get activities and opportunities

## API Integration

The extension communicates with the AIRevenueOrc API:

- Base URL: `https://app.airevenueorc.com/api`
- Authentication: Bearer token (stored in Chrome storage)
- Endpoints used:
  - `POST /auth/login` - User authentication
  - `GET /prospects/search` - Search prospects by email
  - `GET /prospects/{id}` - Get prospect details
  - `GET /prospects/{id}/context` - Get prospect context
  - `POST /activities/log-email` - Log email activity
  - `GET /templates` - Get email templates
  - `GET /templates/{id}` - Get template details
  - `POST /email/tracking/generate` - Generate tracking data

## Security

- Authentication tokens stored in Chrome's local storage (encrypted by Chrome)
- Tokens automatically refreshed when expired
- No sensitive data stored in extension code
- Content Security Policy enforced

## Permissions

Required Chrome permissions:
- `storage` - Store authentication tokens
- `activeTab` - Access current Gmail tab
- `identity` - OAuth authentication (future)

## Development

### Setup

```bash
cd browser-extensions/gmail
npm install
```

### Testing

1. Load extension in developer mode
2. Open Gmail
3. Check console logs for debugging
4. Use Chrome DevTools to inspect sidebar iframe

### Building

```bash
npm run build
```

## Future Enhancements

- [ ] Automatic email sync to AIRevenueOrc
- [ ] AI-powered reply suggestions
- [ ] Meeting scheduler integration
- [ ] Custom field mapping
- [ ] Offline mode support
- [ ] Multi-language support

## Troubleshooting

### Sidebar not appearing
- Refresh Gmail page
- Check if extension is enabled
- Clear browser cache

### Authentication fails
- Verify credentials
- Check API URL configuration
- Clear extension storage

### Templates not loading
- Verify authentication
- Check network connectivity
- Verify templates exist in AIRevenueOrc

## Support

For issues and feature requests, contact support@airevenueorc.com

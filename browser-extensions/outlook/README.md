# AIRevenueOrc for Outlook

Outlook add-in that integrates AIRevenueOrc with Outlook for seamless sales engagement.

## Features

### Prospect Context Task Pane
- Displays prospect information for the current email
- Shows recent activities and opportunities
- Real-time updates when switching emails
- Quick access to full prospect profile

### Email Compose Integration
- **Templates**: Insert pre-built email templates with variable substitution
- **Tracking**: Enable open and click tracking for outbound emails
- **CRM Logging**: Automatically log emails to AIRevenueOrc

### Ribbon Buttons
- **Prospect Context**: Opens task pane with prospect information
- **Log to CRM**: Logs current email as activity
- **Insert Template**: Opens template selector
- **Enable Tracking**: Adds tracking to outbound email

### Template Variables
Supported template variables:
- `{{firstName}}` - Prospect's first name
- `{{lastName}}` - Prospect's last name
- `{{company}}` - Prospect's company
- `{{email}}` - Prospect's email
- `{{title}}` - Prospect's title
- `{{phone}}` - Prospect's phone

## Installation

### Outlook Desktop (Windows/Mac)

1. Open Outlook
2. Go to **Insert** tab
3. Click **Get Add-ins**
4. Search for "AIRevenueOrc"
5. Click **Add**

### Outlook Web

1. Open Outlook on the web
2. Click the gear icon (Settings)
3. Go to **View all Outlook settings** > **Mail** > **Customize actions**
4. Click **Get Add-ins**
5. Search for "AIRevenueOrc"
6. Click **Add**

### Sideloading (Development)

1. Open Outlook
2. Go to **Insert** tab
3. Click **Get Add-ins** > **My Add-ins**
4. Under **Custom Add-ins**, click **Add a custom add-in**
5. Click **Add from URL**
6. Enter: `https://app.airevenueorc.com/outlook/manifest.xml`
7. Click **OK**

## Usage

### Authentication

1. Open the add-in (click any AIRevenueOrc button)
2. Sign in with your AIRevenueOrc credentials
3. The add-in will sync with your account

### Viewing Prospect Context

1. Open any email in Outlook
2. Click the "Prospect Context" button in the ribbon
3. The task pane will display prospect information
4. If no prospect is found, you can create one directly

### Using Templates

1. Open a compose window
2. Click the "Insert Template" button
3. Select a template from the list
4. Variables will be automatically replaced with prospect data
5. The template will be inserted into your email

### Enabling Email Tracking

1. Open a compose window
2. Add a recipient
3. Click the "Enable Tracking" button
4. Tracking pixel and link tracking will be added to your email
5. Opens and clicks will be logged in AIRevenueOrc

### Logging Emails

1. Open an email (read or compose)
2. Click the "Log to CRM" button
3. The email will be saved as an activity in AIRevenueOrc

## Architecture

### Files

- `manifest.xml` - Add-in configuration
- `taskpane.html` - Task pane UI (prospect context)
- `taskpane.js` - Task pane logic
- `commands.html` - Commands page
- `commands.js` - Button command handlers
- `templates.html` - Template selector UI
- `templates.js` - Template selector logic

### Hosting

All files must be hosted on a web server with HTTPS:
- Production: `https://app.airevenueorc.com/outlook/`
- Development: Use local HTTPS server or ngrok

### Communication Flow

```
Outlook
    ↓
Office.js API
    ↓
Add-in JavaScript
    ↓
AIRevenueOrc API
```

## API Integration

The add-in communicates with the AIRevenueOrc API:

- Base URL: `https://app.airevenueorc.com/api`
- Authentication: Bearer token (stored in Office roaming settings)
- Endpoints used:
  - `POST /auth/login` - User authentication
  - `GET /prospects/search` - Search prospects by email
  - `GET /prospects/{id}` - Get prospect details
  - `GET /prospects/{id}/context` - Get prospect context
  - `POST /activities/log-email` - Log email activity
  - `GET /templates` - Get email templates
  - `GET /templates/{id}` - Get template details
  - `POST /email/tracking/generate` - Generate tracking data

## Permissions

Required Outlook permissions:
- `ReadWriteMailbox` - Read and write mail items and compose messages

## Supported Platforms

- Outlook 2016 or later (Windows)
- Outlook 2016 or later (Mac)
- Outlook on the web
- Outlook mobile (iOS/Android) - Limited support

## Office.js Requirements

- Mailbox requirement set 1.3 or higher
- Office.js library loaded from CDN

## Development

### Setup Local Development Server

```bash
cd browser-extensions/outlook

# Install dependencies
npm install

# Start HTTPS development server
npm run dev
```

### Testing

1. Sideload add-in using manifest URL
2. Open Outlook
3. Test all buttons and features
4. Check browser console for errors (F12)

### Building for Production

1. Host files on production server (HTTPS)
2. Update manifest.xml URLs to production URLs
3. Update API_BASE_URL in JavaScript files
4. Validate manifest: https://dev.office.com/add-in-manifest-validator
5. Submit to AppSource (optional)

## Manifest Validation

Use Microsoft's manifest validator:
```bash
npx office-addin-manifest validate manifest.xml
```

## Deployment

### To Production Server

1. Upload all files to `https://app.airevenueorc.com/outlook/`
2. Ensure HTTPS is configured
3. Verify CORS headers allow Outlook domains
4. Test manifest URL is accessible

### To Microsoft AppSource

1. Register app at https://partner.microsoft.com
2. Prepare store assets (icons, screenshots, descriptions)
3. Submit manifest and assets
4. Wait for Microsoft review (7-10 days)
5. Publish to AppSource

## Troubleshooting

### Add-in not loading
- Verify manifest URL is accessible
- Check HTTPS certificate is valid
- Clear Office cache: Delete `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\`
- Restart Outlook

### Authentication fails
- Verify API URL is correct
- Check network connectivity
- Clear Office roaming settings
- Re-authenticate

### Templates not loading
- Verify authentication token is valid
- Check API endpoint is responding
- Verify templates exist in AIRevenueOrc

### Buttons not appearing
- Verify Office.js is loaded
- Check manifest ExtensionPoints are correct
- Restart Outlook

## Security

- Authentication tokens stored in Office roaming settings (encrypted by Office)
- Tokens automatically refreshed when expired
- No sensitive data stored in add-in code
- All API communication over HTTPS

## Future Enhancements

- [ ] Automatic email sync to AIRevenueOrc
- [ ] AI-powered reply suggestions
- [ ] Meeting scheduler integration
- [ ] Custom field mapping
- [ ] Offline mode support
- [ ] Multi-language support
- [ ] Mobile app optimization

## Support

For issues and feature requests:
- Email: support@airevenueorc.com
- Documentation: https://docs.airevenueorc.com/outlook
- GitHub: https://github.com/airevenueorc/outlook-addin

## Resources

- [Office Add-ins Documentation](https://docs.microsoft.com/en-us/office/dev/add-ins/)
- [Office.js API Reference](https://docs.microsoft.com/en-us/javascript/api/outlook)
- [AppSource Submission Guide](https://docs.microsoft.com/en-us/office/dev/store/submit-to-appsource-via-partner-center)

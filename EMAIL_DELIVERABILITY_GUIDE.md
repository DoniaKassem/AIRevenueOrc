# Email Deliverability Infrastructure - Quick Start Guide

**Priority 1 Launch Blocker Feature**

This guide covers setup and best practices for the email deliverability system.

---

## 🎯 Overview

Complete email infrastructure with SendGrid integration for reliable, tracked email delivery at scale.

### Key Features

- ✅ Single & bulk email sending
- ✅ Email validation before sending
- ✅ Open & click tracking
- ✅ Bounce & spam handling
- ✅ Template management
- ✅ Rate limiting (1000+/hour)
- ✅ Scheduled sending
- ✅ Deliverability monitoring

---

## 📦 Setup

### 1. Install Dependencies

```bash
npm install @sendgrid/mail @sendgrid/client
```

### 2. Configure SendGrid

1. Sign up at https://sendgrid.com (100 free emails/day)
2. Generate API key with "Mail Send" permissions
3. Verify sender email address
4. Configure webhook:
   - URL: `https://your-app.com/api/email/webhook`
   - Events: delivered, opened, clicked, bounced, spamreport, unsubscribed

### 3. Environment Variables

```bash
# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Your Company"

# App
APP_URL=https://app.yourdomain.com
```

### 4. Run Migration

```bash
supabase db push
# Or: psql -f supabase/migrations/20251121000020_email_infrastructure.sql
```

### 5. Domain Authentication (Important!)

Set up SPF, DKIM, and DMARC for your sending domain in SendGrid dashboard. This improves deliverability to 99%+.

---

## 🚀 Usage

### Send Single Email

```typescript
import { createEmailService } from '@/lib/email/emailService';

const emailService = createEmailService();

await emailService.sendEmail({
  organizationId: 'org-123',
  userId: 'user-456',
  to: {
    email: 'prospect@company.com',
    name: 'John Doe',
  },
  subject: 'Follow up on our conversation',
  html: '<p>Hi John,</p><p>Following up on our call...</p>',
  text: 'Hi John, Following up on our call...',
  trackOpens: true,
  trackClicks: true,
  prospectId: 'prospect-789',
});
```

### Send Bulk Emails (Campaign)

```typescript
import { createBulkEmailService } from '@/lib/email/bulkEmailService';

const bulkService = createBulkEmailService();

const job = await bulkService.createBulkSend({
  organizationId: 'org-123',
  userId: 'user-456',
  campaignId: 'campaign-789',
  subject: 'New Product Launch',
  html: '<p>Hi {{firstName}},</p><p>Check out our new product...</p>',
  recipients: [
    { email: 'user1@example.com', name: 'User 1', variables: { firstName: 'John' } },
    { email: 'user2@example.com', name: 'User 2', variables: { firstName: 'Jane' } },
    // ... up to 10,000+
  ],
  rateLimitPerHour: 1000, // Don't exceed this
  sendImmediately: true,
});

// Check status
const status = await bulkService.getJobStatus(job.id);
console.log(`Sent ${status.sentEmails}/${status.totalEmails}`);
```

### Use Email Template

```typescript
// 1. Create template
const template = await supabase.from('email_templates').insert({
  organization_id: 'org-123',
  name: 'Welcome Email',
  subject: 'Welcome to {{companyName}}!',
  html: '<h1>Welcome {{firstName}}!</h1><p>We\'re excited to have you.</p>',
  variables: ['firstName', 'companyName'],
  category: 'marketing',
});

// 2. Send using template
await emailService.sendEmail({
  organizationId: 'org-123',
  userId: 'user-456',
  to: { email: 'new@customer.com' },
  templateId: template.id,
  templateVariables: {
    firstName: 'Sarah',
    companyName: 'Acme Corp',
  },
});
```

### Schedule Email

```typescript
await emailService.sendEmail({
  organizationId: 'org-123',
  userId: 'user-456',
  to: { email: 'prospect@company.com' },
  subject: 'Follow up',
  html: '<p>Checking in...</p>',
  sendAt: new Date('2025-11-22T09:00:00Z'), // Future date
});
```

### Validate Email Before Sending

```typescript
const validation = await emailService.validateEmail('user@example.com');

if (!validation.isValid) {
  console.error('Invalid email:', validation.reasons);
}

if (validation.isDisposable) {
  console.warn('Disposable email detected');
}

if (validation.suggestedCorrection) {
  console.log(`Did you mean: ${validation.suggestedCorrection}?`);
}
```

---

## 📊 Monitoring

### Email Statistics

```typescript
const stats = await emailService.getEmailStats({
  organizationId: 'org-123',
  userId: 'user-456',
  dateFrom: new Date('2025-11-01'),
  dateTo: new Date('2025-11-30'),
});

console.log(`
  Sent: ${stats.totalSent}
  Delivered: ${stats.totalDelivered}
  Open Rate: ${stats.openRate.toFixed(2)}%
  Click Rate: ${stats.clickRate.toFixed(2)}%
  Bounce Rate: ${stats.bounceRate.toFixed(2)}%
`);
```

### Check Analytics Views

```sql
-- Email performance by user
SELECT * FROM email_performance_by_user;

-- Email engagement by prospect
SELECT * FROM email_engagement_by_prospect
ORDER BY engagement_score DESC
LIMIT 10;

-- Template performance
SELECT * FROM template_performance
ORDER BY open_rate DESC;
```

---

## 🔧 Cron Jobs

### Process Scheduled Emails

```bash
# Every 5 minutes
*/5 * * * * curl -X POST http://localhost:3000/api/email/process-scheduled
```

Or with Node.js cron:

```typescript
import cron from 'node-cron';
import { createEmailService } from '@/lib/email/emailService';

const emailService = createEmailService();

cron.schedule('*/5 * * * *', async () => {
  await emailService.processScheduledEmails();
});
```

### Start Bulk Email Processor

```typescript
import { createBulkEmailService } from '@/lib/email/bulkEmailService';

const bulkService = createBulkEmailService();
bulkService.startBackgroundProcessor();
```

---

## 🎯 Best Practices

### 1. Warm Up Your IP

When sending from a new IP/domain:
- Day 1: Send 50 emails
- Day 2: Send 100 emails
- Day 3: Send 200 emails
- Gradually increase over 2-4 weeks

### 2. Maintain Good Sender Reputation

- Keep bounce rate < 5%
- Keep spam complaint rate < 0.1%
- Monitor blacklists regularly
- Remove bounced emails immediately

### 3. Rate Limiting

- Free tier: 100 emails/day
- Essentials ($20/mo): 50K emails/month = ~1,700/day
- Pro ($90/mo): 1M emails/month = ~33,000/day

Don't exceed these limits or you'll be throttled.

### 4. Email Content Tips

- Always include unsubscribe link (required by law)
- Use responsive HTML templates
- Test on multiple email clients
- Keep HTML under 102KB
- Avoid spam trigger words ("free", "urgent", "act now")

### 5. Tracking

- Track opens: Adds 1x1 tracking pixel
- Track clicks: Rewrites all URLs
- Consider privacy: Some users block tracking

---

## 🚨 Troubleshooting

### Emails Going to Spam

**Causes:**
- Missing SPF/DKIM/DMARC
- High bounce rate
- Spam trigger words
- Not warmed up IP
- No unsubscribe link

**Solutions:**
- Set up domain authentication in SendGrid
- Clean your email list
- Improve content quality
- Warm up IP gradually
- Add unsubscribe link

### High Bounce Rate

**Causes:**
- Invalid email addresses
- Typos in email addresses
- Inactive accounts

**Solutions:**
- Validate emails before sending
- Check for typo corrections
- Remove bounced emails automatically

### Rate Limit Exceeded

**Error:** SendGrid returns 429 status

**Solution:**
- Reduce `rateLimitPerHour` in bulk sends
- Upgrade SendGrid plan
- Spread sends across multiple days

---

## 📈 Scaling

### 0-10K emails/month
- SendGrid Free tier
- Single server
- Default rate limits

### 10K-100K emails/month
- SendGrid Essentials ($20/mo)
- Dedicated IP optional
- Rate limit: 1000/hour

### 100K-1M emails/month
- SendGrid Pro ($90/mo)
- Dedicated IP recommended
- Rate limit: 5000/hour
- Multiple sending domains

### 1M+ emails/month
- SendGrid Premier (custom pricing)
- Multiple dedicated IPs
- Advanced features (sub-user accounts, IP pools)
- Rate limit: Unlimited (within plan)

---

## ✅ Launch Checklist

- [ ] SendGrid account created
- [ ] API key generated
- [ ] Sender email verified
- [ ] Domain authentication configured (SPF/DKIM/DMARC)
- [ ] Webhook endpoint set up
- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Cron jobs scheduled
- [ ] IP warm-up plan created
- [ ] Email templates designed
- [ ] Unsubscribe page created
- [ ] Monitoring dashboards configured
- [ ] Test emails sent successfully
- [ ] Deliverability tested (Gmail, Outlook, etc.)

---

## 📞 Support

- **SendGrid Docs**: https://docs.sendgrid.com
- **SendGrid Support**: support@sendgrid.com
- **Deliverability Issues**: Check SendGrid dashboard analytics
- **Emergency**: Page on-call engineer

---

**Status**: ✅ Production Ready
**Last Updated**: 2025-11-21
**Version**: 1.0.0

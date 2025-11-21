/**
 * Email Sync Engine
 * Syncs emails bidirectionally via IMAP/SMTP and OAuth
 */

import { ImapFlow, ImapFlowOptions } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { supabase } from '../supabase';

export type EmailProvider = 'gmail' | 'outlook' | 'office365' | 'imap_smtp' | 'exchange';

export interface EmailSyncConfig {
  id: string;
  userId: string;
  teamId: string;
  provider: EmailProvider;

  // OAuth (for Gmail/Outlook)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;

  // IMAP/SMTP (for generic providers)
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  username?: string;
  password?: string;

  // Email address
  emailAddress: string;

  // Sync settings
  syncEnabled: boolean;
  syncInbound: boolean;
  syncOutbound: boolean;
  syncInterval: number; // minutes
  lastSyncAt?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMessage {
  id: string;
  messageId: string;
  threadId?: string;

  from: { name?: string; address: string };
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  bcc?: Array<{ name?: string; address: string }>;

  subject: string;
  body: string;
  bodyHtml?: string;

  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    data?: Buffer;
  }>;

  date: Date;
  inReplyTo?: string;
  references?: string[];

  headers?: Record<string, string>;
}

export interface SyncResult {
  success: boolean;
  inboundSynced: number;
  outboundSynced: number;
  errors: string[];
  lastSyncedMessageId?: string;
}

/**
 * Email Sync Engine
 */
export class EmailSyncEngine {
  private config: EmailSyncConfig;
  private imapClient?: ImapFlow;
  private smtpTransport?: nodemailer.Transporter;

  constructor(config: EmailSyncConfig) {
    this.config = config;
  }

  /**
   * Initialize connections
   */
  async initialize(): Promise<void> {
    if (this.config.provider === 'gmail') {
      await this.initializeGmail();
    } else if (this.config.provider === 'outlook' || this.config.provider === 'office365') {
      await this.initializeOutlook();
    } else {
      await this.initializeIMAP();
      await this.initializeSMTP();
    }
  }

  /**
   * Sync emails (inbound and outbound)
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      inboundSynced: 0,
      outboundSynced: 0,
      errors: [],
    };

    try {
      await this.initialize();

      // Sync inbound emails
      if (this.config.syncInbound) {
        result.inboundSynced = await this.syncInbound();
      }

      // Sync outbound emails
      if (this.config.syncOutbound) {
        result.outboundSynced = await this.syncOutbound();
      }

      result.success = true;

      // Update last sync timestamp
      await this.updateLastSync();

      return result;
    } catch (error) {
      console.error('[EmailSync] Sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Send email via SMTP
   */
  async sendEmail(message: Partial<EmailMessage>): Promise<string> {
    try {
      await this.initializeSMTP();

      if (!this.smtpTransport) {
        throw new Error('SMTP transport not initialized');
      }

      const mailOptions = {
        from: message.from?.address || this.config.emailAddress,
        to: message.to?.map(t => t.address).join(', '),
        cc: message.cc?.map(t => t.address).join(', '),
        bcc: message.bcc?.map(t => t.address).join(', '),
        subject: message.subject,
        text: message.body,
        html: message.bodyHtml,
        inReplyTo: message.inReplyTo,
        references: message.references,
      };

      const info = await this.smtpTransport.sendMail(mailOptions);

      console.log(`[EmailSync] Email sent: ${info.messageId}`);

      return info.messageId;
    } catch (error) {
      console.error('[EmailSync] Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Disconnect from email server
   */
  async disconnect(): Promise<void> {
    if (this.imapClient) {
      try {
        await this.imapClient.logout();
      } catch (error) {
        console.error('[EmailSync] IMAP logout error:', error);
      }
    }

    if (this.smtpTransport) {
      try {
        this.smtpTransport.close();
      } catch (error) {
        console.error('[EmailSync] SMTP close error:', error);
      }
    }
  }

  // Private methods

  private async initializeGmail(): Promise<void> {
    // Gmail via OAuth2
    // In production, implement Gmail API with OAuth2
    // For now, use IMAP with app password as fallback
    await this.initializeIMAP();
    await this.initializeSMTP();
  }

  private async initializeOutlook(): Promise<void> {
    // Outlook via OAuth2 and Microsoft Graph API
    // In production, implement Graph API
    // For now, use IMAP/SMTP as fallback
    await this.initializeIMAP();
    await this.initializeSMTP();
  }

  private async initializeIMAP(): Promise<void> {
    if (!this.config.imapHost) {
      throw new Error('IMAP host not configured');
    }

    const options: ImapFlowOptions = {
      host: this.config.imapHost,
      port: this.config.imapPort || 993,
      secure: this.config.imapSecure !== false,
      auth: {
        user: this.config.username || this.config.emailAddress,
        pass: this.config.password!,
      },
      logger: false,
    };

    this.imapClient = new ImapFlow(options);
    await this.imapClient.connect();

    console.log('[EmailSync] IMAP connected');
  }

  private async initializeSMTP(): Promise<void> {
    if (!this.config.smtpHost) {
      throw new Error('SMTP host not configured');
    }

    this.smtpTransport = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort || 587,
      secure: this.config.smtpSecure || false,
      auth: {
        user: this.config.username || this.config.emailAddress,
        pass: this.config.password!,
      },
    });

    console.log('[EmailSync] SMTP initialized');
  }

  private async syncInbound(): Promise<number> {
    if (!this.imapClient) {
      throw new Error('IMAP client not initialized');
    }

    let synced = 0;

    try {
      // Select inbox
      await this.imapClient.mailboxOpen('INBOX');

      // Get last synced message UID
      const lastUid = await this.getLastSyncedUid();

      // Fetch new messages
      const fetchOptions = lastUid
        ? { uid: `${lastUid + 1}:*` }
        : { uid: '1:*' };

      for await (const message of this.imapClient.fetch(fetchOptions, {
        envelope: true,
        bodyStructure: true,
        source: true,
        uid: true,
      })) {
        try {
          const parsed = await simpleParser(message.source);

          const emailMessage: EmailMessage = {
            id: crypto.randomUUID(),
            messageId: parsed.messageId || '',
            threadId: parsed.inReplyTo || parsed.messageId || undefined,
            from: {
              name: parsed.from?.value[0]?.name,
              address: parsed.from?.value[0]?.address || '',
            },
            to: parsed.to?.value.map(t => ({ name: t.name, address: t.address || '' })) || [],
            cc: parsed.cc?.value.map(t => ({ name: t.name, address: t.address || '' })),
            subject: parsed.subject || '',
            body: parsed.text || '',
            bodyHtml: parsed.html || undefined,
            date: parsed.date || new Date(),
            inReplyTo: parsed.inReplyTo,
            references: parsed.references,
          };

          // Store in database
          await this.storeInboundEmail(emailMessage, message.uid);

          synced++;
        } catch (error) {
          console.error('[EmailSync] Failed to process message:', error);
        }
      }

      console.log(`[EmailSync] Synced ${synced} inbound emails`);
    } catch (error) {
      console.error('[EmailSync] Inbound sync failed:', error);
      throw error;
    }

    return synced;
  }

  private async syncOutbound(): Promise<number> {
    if (!this.imapClient) {
      throw new Error('IMAP client not initialized');
    }

    let synced = 0;

    try {
      // Select sent folder
      const sentFolder = await this.findSentFolder();
      if (!sentFolder) {
        console.warn('[EmailSync] Sent folder not found');
        return 0;
      }

      await this.imapClient.mailboxOpen(sentFolder);

      // Get last synced message UID
      const lastUid = await this.getLastSyncedUid('sent');

      // Fetch new messages
      const fetchOptions = lastUid
        ? { uid: `${lastUid + 1}:*` }
        : { uid: '1:*' };

      for await (const message of this.imapClient.fetch(fetchOptions, {
        envelope: true,
        bodyStructure: true,
        source: true,
        uid: true,
      })) {
        try {
          const parsed = await simpleParser(message.source);

          const emailMessage: EmailMessage = {
            id: crypto.randomUUID(),
            messageId: parsed.messageId || '',
            threadId: parsed.inReplyTo || parsed.messageId || undefined,
            from: {
              name: parsed.from?.value[0]?.name,
              address: parsed.from?.value[0]?.address || '',
            },
            to: parsed.to?.value.map(t => ({ name: t.name, address: t.address || '' })) || [],
            cc: parsed.cc?.value.map(t => ({ name: t.name, address: t.address || '' })),
            subject: parsed.subject || '',
            body: parsed.text || '',
            bodyHtml: parsed.html || undefined,
            date: parsed.date || new Date(),
            inReplyTo: parsed.inReplyTo,
            references: parsed.references,
          };

          // Store in database
          await this.storeOutboundEmail(emailMessage, message.uid);

          synced++;
        } catch (error) {
          console.error('[EmailSync] Failed to process sent message:', error);
        }
      }

      console.log(`[EmailSync] Synced ${synced} outbound emails`);
    } catch (error) {
      console.error('[EmailSync] Outbound sync failed:', error);
      throw error;
    }

    return synced;
  }

  private async findSentFolder(): Promise<string | null> {
    if (!this.imapClient) return null;

    // Common sent folder names
    const sentFolderNames = ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail'];

    const mailboxes = await this.imapClient.list();

    for (const mailbox of mailboxes) {
      if (sentFolderNames.some(name => mailbox.path.includes(name))) {
        return mailbox.path;
      }
    }

    return null;
  }

  private async getLastSyncedUid(folder: 'inbox' | 'sent' = 'inbox'): Promise<number> {
    const { data } = await supabase
      .from('email_sync_state')
      .select('last_synced_uid')
      .eq('config_id', this.config.id)
      .eq('folder', folder)
      .single();

    return data?.last_synced_uid || 0;
  }

  private async storeInboundEmail(email: EmailMessage, uid: number): Promise<void> {
    // Check if prospect exists
    const { data: prospect } = await supabase
      .from('prospects')
      .select('id')
      .eq('email', email.from.address)
      .single();

    if (!prospect) {
      console.log(`[EmailSync] No prospect found for ${email.from.address}, skipping`);
      return;
    }

    // Store email activity
    await supabase.from('bdr_activities').insert({
      team_id: this.config.teamId,
      prospect_id: prospect.id,
      activity_type: 'email_received',
      direction: 'inbound',
      metadata: {
        message_id: email.messageId,
        thread_id: email.threadId,
        subject: email.subject,
        body: email.body,
        from: email.from,
        to: email.to,
      },
      created_at: email.date.toISOString(),
    });

    // Update sync state
    await this.updateSyncState('inbox', uid);

    console.log(`[EmailSync] Stored inbound email: ${email.subject}`);
  }

  private async storeOutboundEmail(email: EmailMessage, uid: number): Promise<void> {
    // Check if prospect exists
    const toAddress = email.to[0]?.address;
    if (!toAddress) return;

    const { data: prospect } = await supabase
      .from('prospects')
      .select('id')
      .eq('email', toAddress)
      .single();

    if (!prospect) {
      console.log(`[EmailSync] No prospect found for ${toAddress}, skipping`);
      return;
    }

    // Store email activity
    await supabase.from('bdr_activities').insert({
      team_id: this.config.teamId,
      prospect_id: prospect.id,
      activity_type: 'email_sent',
      direction: 'outbound',
      metadata: {
        message_id: email.messageId,
        thread_id: email.threadId,
        subject: email.subject,
        body: email.body,
        from: email.from,
        to: email.to,
      },
      created_at: email.date.toISOString(),
    });

    // Update sync state
    await this.updateSyncState('sent', uid);

    console.log(`[EmailSync] Stored outbound email: ${email.subject}`);
  }

  private async updateSyncState(folder: 'inbox' | 'sent', uid: number): Promise<void> {
    await supabase.from('email_sync_state').upsert({
      config_id: this.config.id,
      folder,
      last_synced_uid: uid,
      last_synced_at: new Date().toISOString(),
    });
  }

  private async updateLastSync(): Promise<void> {
    await supabase
      .from('email_sync_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', this.config.id);
  }
}

/**
 * Create email sync engine
 */
export function createEmailSyncEngine(config: EmailSyncConfig): EmailSyncEngine {
  return new EmailSyncEngine(config);
}

/**
 * Get default IMAP/SMTP settings for provider
 */
export function getProviderDefaults(provider: EmailProvider): {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
} {
  const defaults: Record<EmailProvider, any> = {
    gmail: {
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
    },
    outlook: {
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpSecure: false,
    },
    office365: {
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpSecure: false,
    },
    imap_smtp: {
      imapHost: '',
      imapPort: 993,
      imapSecure: true,
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
    },
    exchange: {
      imapHost: '',
      imapPort: 993,
      imapSecure: true,
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
    },
  };

  return defaults[provider];
}

/**
 * Multi-Factor Authentication (MFA) System
 * Supports TOTP (Time-based One-Time Password) and SMS
 */

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { supabase } from '../supabase';
import crypto from 'crypto';

export type MFAMethod = 'totp' | 'sms' | 'backup_codes';

export interface MFAConfig {
  id: string;
  userId: string;
  method: MFAMethod;
  isEnabled: boolean;
  isVerified: boolean;
  secret?: string;
  phoneNumber?: string;
  backupCodes?: string[];
  createdAt: string;
  verifiedAt?: string;
}

export interface TOTPSetupResult {
  secret: string;
  qrCode: string; // Base64 encoded QR code image
  backupCodes: string[];
  manualEntryKey: string; // For manual entry if QR fails
}

export interface MFAVerifyResult {
  success: boolean;
  method: MFAMethod;
  error?: string;
}

/**
 * MFA Manager
 */
export class MFAManager {
  private appName = 'AIRevenueOrc';

  /**
   * Setup TOTP (Authenticator App) for user
   */
  async setupTOTP(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${this.appName} (${userEmail})`,
      issuer: this.appName,
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Store MFA config (not verified yet)
    await supabase.from('mfa_configurations').upsert({
      user_id: userId,
      method: 'totp',
      secret: secret.base32,
      backup_codes: backupCodes,
      is_enabled: false,
      is_verified: false,
      created_at: new Date().toISOString(),
    });

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Verify TOTP setup
   */
  async verifyTOTPSetup(userId: string, token: string): Promise<MFAVerifyResult> {
    // Get MFA config
    const { data: config } = await supabase
      .from('mfa_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('method', 'totp')
      .single();

    if (!config || !config.secret) {
      return {
        success: false,
        method: 'totp',
        error: 'TOTP not setup',
      };
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: config.secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after
    });

    if (!verified) {
      return {
        success: false,
        method: 'totp',
        error: 'Invalid token',
      };
    }

    // Mark as verified and enabled
    await supabase
      .from('mfa_configurations')
      .update({
        is_verified: true,
        is_enabled: true,
        verified_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('method', 'totp');

    // Log MFA enablement
    await this.logMFAEvent({
      userId,
      method: 'totp',
      action: 'enabled',
      success: true,
    });

    return {
      success: true,
      method: 'totp',
    };
  }

  /**
   * Verify TOTP token during login
   */
  async verifyTOTP(userId: string, token: string): Promise<MFAVerifyResult> {
    // Get MFA config
    const { data: config } = await supabase
      .from('mfa_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('method', 'totp')
      .eq('is_enabled', true)
      .single();

    if (!config || !config.secret) {
      return {
        success: false,
        method: 'totp',
        error: 'TOTP not enabled',
      };
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: config.secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    // Log verification attempt
    await this.logMFAEvent({
      userId,
      method: 'totp',
      action: 'verify',
      success: verified,
    });

    if (!verified) {
      return {
        success: false,
        method: 'totp',
        error: 'Invalid token',
      };
    }

    return {
      success: true,
      method: 'totp',
    };
  }

  /**
   * Setup SMS MFA
   */
  async setupSMS(userId: string, phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    // Validate phone number format
    if (!this.isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    // Generate and send verification code
    const verificationCode = this.generateSMSCode();

    // Store temporary verification code
    await supabase.from('mfa_sms_codes').insert({
      user_id: userId,
      phone_number: phoneNumber,
      code: verificationCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      created_at: new Date().toISOString(),
    });

    // Send SMS (integrate with Twilio)
    await this.sendSMS(phoneNumber, `Your ${this.appName} verification code is: ${verificationCode}`);

    return { success: true };
  }

  /**
   * Verify SMS setup
   */
  async verifySMSSetup(userId: string, phoneNumber: string, code: string): Promise<MFAVerifyResult> {
    // Get verification code
    const { data: smsCode } = await supabase
      .from('mfa_sms_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('phone_number', phoneNumber)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!smsCode) {
      return {
        success: false,
        method: 'sms',
        error: 'Invalid or expired code',
      };
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    // Create or update MFA config
    await supabase.from('mfa_configurations').upsert({
      user_id: userId,
      method: 'sms',
      phone_number: phoneNumber,
      backup_codes: backupCodes,
      is_enabled: true,
      is_verified: true,
      verified_at: new Date().toISOString(),
    });

    // Delete used code
    await supabase
      .from('mfa_sms_codes')
      .delete()
      .eq('id', smsCode.id);

    // Log MFA enablement
    await this.logMFAEvent({
      userId,
      method: 'sms',
      action: 'enabled',
      success: true,
    });

    return {
      success: true,
      method: 'sms',
    };
  }

  /**
   * Send SMS code for login
   */
  async sendSMSCode(userId: string): Promise<{ success: boolean; error?: string }> {
    // Get MFA config
    const { data: config } = await supabase
      .from('mfa_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('method', 'sms')
      .eq('is_enabled', true)
      .single();

    if (!config || !config.phone_number) {
      return {
        success: false,
        error: 'SMS MFA not enabled',
      };
    }

    // Generate and send verification code
    const verificationCode = this.generateSMSCode();

    // Store temporary verification code
    await supabase.from('mfa_sms_codes').insert({
      user_id: userId,
      phone_number: config.phone_number,
      code: verificationCode,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });

    // Send SMS
    await this.sendSMS(config.phone_number, `Your ${this.appName} verification code is: ${verificationCode}`);

    return { success: true };
  }

  /**
   * Verify SMS code during login
   */
  async verifySMSCode(userId: string, code: string): Promise<MFAVerifyResult> {
    // Get verification code
    const { data: smsCode } = await supabase
      .from('mfa_sms_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!smsCode) {
      await this.logMFAEvent({
        userId,
        method: 'sms',
        action: 'verify',
        success: false,
      });

      return {
        success: false,
        method: 'sms',
        error: 'Invalid or expired code',
      };
    }

    // Delete used code
    await supabase
      .from('mfa_sms_codes')
      .delete()
      .eq('id', smsCode.id);

    // Log successful verification
    await this.logMFAEvent({
      userId,
      method: 'sms',
      action: 'verify',
      success: true,
    });

    return {
      success: true,
      method: 'sms',
    };
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<MFAVerifyResult> {
    // Get all MFA configs for user
    const { data: configs } = await supabase
      .from('mfa_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_enabled', true);

    if (!configs || configs.length === 0) {
      return {
        success: false,
        method: 'backup_codes',
        error: 'MFA not enabled',
      };
    }

    // Check if backup code matches any config
    for (const config of configs) {
      if (config.backup_codes && config.backup_codes.includes(code)) {
        // Remove used backup code
        const updatedCodes = config.backup_codes.filter((c: string) => c !== code);

        await supabase
          .from('mfa_configurations')
          .update({ backup_codes: updatedCodes })
          .eq('id', config.id);

        // Log backup code usage
        await this.logMFAEvent({
          userId,
          method: 'backup_codes',
          action: 'verify',
          success: true,
        });

        return {
          success: true,
          method: 'backup_codes',
        };
      }
    }

    // Log failed verification
    await this.logMFAEvent({
      userId,
      method: 'backup_codes',
      action: 'verify',
      success: false,
    });

    return {
      success: false,
      method: 'backup_codes',
      error: 'Invalid backup code',
    };
  }

  /**
   * Get user's MFA configurations
   */
  async getUserMFAConfigs(userId: string): Promise<MFAConfig[]> {
    const { data: configs } = await supabase
      .from('mfa_configurations')
      .select('*')
      .eq('user_id', userId);

    if (!configs) {
      return [];
    }

    return configs.map(c => ({
      id: c.id,
      userId: c.user_id,
      method: c.method,
      isEnabled: c.is_enabled,
      isVerified: c.is_verified,
      secret: c.secret,
      phoneNumber: c.phone_number,
      backupCodes: c.backup_codes,
      createdAt: c.created_at,
      verifiedAt: c.verified_at,
    }));
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('mfa_configurations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_enabled', true)
      .limit(1)
      .single();

    return !!data;
  }

  /**
   * Disable MFA method
   */
  async disableMFA(userId: string, method: MFAMethod): Promise<void> {
    await supabase
      .from('mfa_configurations')
      .update({ is_enabled: false })
      .eq('user_id', userId)
      .eq('method', method);

    // Log MFA disablement
    await this.logMFAEvent({
      userId,
      method,
      action: 'disabled',
      success: true,
    });
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, method: MFAMethod): Promise<string[]> {
    const newBackupCodes = this.generateBackupCodes(10);

    await supabase
      .from('mfa_configurations')
      .update({ backup_codes: newBackupCodes })
      .eq('user_id', userId)
      .eq('method', method);

    return newBackupCodes;
  }

  // Private helper methods

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  private generateSMSCode(): string {
    // Generate 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation for E.164 format: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // In production, integrate with Twilio
    // For now, just log
    console.log(`[MFA] Would send SMS to ${phoneNumber}: ${message}`);

    // TODO: Implement Twilio integration
    // const twilio = require('twilio');
    // const client = twilio(accountSid, authToken);
    // await client.messages.create({
    //   body: message,
    //   from: twilioPhoneNumber,
    //   to: phoneNumber,
    // });
  }

  private async logMFAEvent(params: {
    userId: string;
    method: MFAMethod;
    action: string;
    success: boolean;
  }): Promise<void> {
    await supabase.from('mfa_audit_log').insert({
      user_id: params.userId,
      method: params.method,
      action: params.action,
      success: params.success,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create MFA manager instance
 */
export function createMFAManager(): MFAManager {
  return new MFAManager();
}

/**
 * MFA Middleware - Check if MFA is required and verified
 */
export async function requireMFA(userId: string): Promise<{ required: boolean; methods: MFAMethod[] }> {
  const mfa = createMFAManager();
  const configs = await mfa.getUserMFAConfigs(userId);

  const enabledMethods = configs
    .filter(c => c.isEnabled && c.isVerified)
    .map(c => c.method);

  return {
    required: enabledMethods.length > 0,
    methods: enabledMethods,
  };
}

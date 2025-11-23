/**
 * User Profile Service
 *
 * Handles user operations:
 * - Update profile
 * - Change password
 * - Update preferences
 * - Enable/disable 2FA
 */

import { supabase } from '../supabase';
import bcrypt from 'bcryptjs';

// =============================================
// TYPES
// =============================================

export interface UpdateProfileParams {
  userId: string;
  name?: string;
  email?: string;
}

export interface ChangePasswordParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesParams {
  userId: string;
  emailNotifications?: boolean;
  desktopNotifications?: boolean;
  weeklyDigest?: boolean;
}

// =============================================
// SERVICE
// =============================================

export class UserService {
  /**
   * Update user profile
   */
  async updateProfile(params: UpdateProfileParams): Promise<void> {
    const updates: any = {};

    if (params.name) updates.name = params.name;
    if (params.email) updates.email = params.email;

    if (Object.keys(updates).length === 0) {
      return; // Nothing to update
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', params.userId);

    if (error) throw error;
  }

  /**
   * Change user password
   */
  async changePassword(params: ChangePasswordParams): Promise<void> {
    // Get current password hash
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', params.userId)
      .single();

    if (fetchError || !user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(params.currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(params.newPassword, 10);

    // Update password
    const { error } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', params.userId);

    if (error) throw error;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(params: UpdatePreferencesParams): Promise<void> {
    // Get existing preferences
    const { data: existing, error: fetchError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', params.userId)
      .single();

    const preferences = {
      email_notifications: params.emailNotifications ?? existing?.email_notifications ?? true,
      desktop_notifications: params.desktopNotifications ?? existing?.desktop_notifications ?? true,
      weekly_digest: params.weeklyDigest ?? existing?.weekly_digest ?? true,
    };

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('user_preferences')
        .update(preferences)
        .eq('user_id', params.userId);

      if (error) throw error;
    } else {
      // Create new
      const { error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: params.userId,
          ...preferences,
        });

      if (error) throw error;
    }
  }

  /**
   * Enable two-factor authentication
   */
  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    // Generate 2FA secret
    // In production, use a library like speakeasy
    const secret = this.generate2FASecret();

    const { error } = await supabase
      .from('users')
      .update({
        two_factor_enabled: true,
        two_factor_secret: secret,
      })
      .eq('id', userId);

    if (error) throw error;

    // Generate QR code (placeholder)
    const qrCode = `otpauth://totp/AIRevenueOrc:user?secret=${secret}`;

    return { secret, qrCode };
  }

  /**
   * Disable two-factor authentication
   */
  async disable2FA(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
      })
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<{
    emailNotifications: boolean;
    desktopNotifications: boolean;
    weeklyDigest: boolean;
  }> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        emailNotifications: true,
        desktopNotifications: true,
        weeklyDigest: true,
      };
    }

    return {
      emailNotifications: data.email_notifications,
      desktopNotifications: data.desktop_notifications,
      weeklyDigest: data.weekly_digest,
    };
  }

  /**
   * Generate 2FA secret (placeholder)
   */
  private generate2FASecret(): string {
    // In production, use speakeasy.generateSecret()
    return Math.random().toString(36).substring(2, 15);
  }
}

export const userService = new UserService();

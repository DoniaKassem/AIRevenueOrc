/**
 * Team Management Service
 *
 * Handles team operations:
 * - List team members
 * - Invite new members
 * - Update member roles
 * - Remove members
 * - Manage invitations
 */

import { supabase } from '../supabase';
import crypto from 'crypto';

// =============================================
// TYPES
// =============================================

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  joinedAt: string;
  lastActive?: string;
  organizationId: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
  organizationId: string;
  token: string;
}

export interface InviteMemberParams {
  email: string;
  role: 'admin' | 'user' | 'viewer';
  organizationId: string;
  invitedBy: string;
}

// =============================================
// SERVICE
// =============================================

export class TeamService {
  /**
   * Get all team members for an organization
   */
  async getTeamMembers(organizationId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, status, created_at, last_active_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role,
      status: user.status || 'active',
      joinedAt: user.created_at,
      lastActive: user.last_active_at,
      organizationId,
    }));
  }

  /**
   * Get pending invitations for an organization
   */
  async getInvitations(organizationId: string): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['pending'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invited_by,
      invitedAt: inv.created_at,
      expiresAt: inv.expires_at,
      status: inv.status,
      organizationId: inv.organization_id,
      token: inv.token,
    }));
  }

  /**
   * Invite a new team member
   */
  async inviteMember(params: InviteMemberParams): Promise<Invitation> {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', params.email)
      .eq('organization_id', params.organizationId)
      .single();

    if (existingUser) {
      throw new Error('User already exists in this organization');
    }

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('email', params.email)
      .eq('organization_id', params.organizationId)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      throw new Error('Invitation already sent to this email');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        email: params.email,
        role: params.role,
        organization_id: params.organizationId,
        invited_by: params.invitedBy,
        token,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Send invitation email
    // await sendInvitationEmail(params.email, token);

    return {
      id: data.id,
      email: data.email,
      role: data.role,
      invitedBy: data.invited_by,
      invitedAt: data.created_at,
      expiresAt: data.expires_at,
      status: data.status,
      organizationId: data.organization_id,
      token: data.token,
    };
  }

  /**
   * Update team member role
   */
  async updateMemberRole(
    memberId: string,
    role: 'admin' | 'user' | 'viewer',
    organizationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', memberId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Remove team member
   */
  async removeMember(memberId: string, organizationId: string): Promise<void> {
    // Soft delete - set status to suspended
    const { error } = await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', memberId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string, organizationId: string): Promise<void> {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('email, token')
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
      .single();

    if (error) throw error;

    // TODO: Send invitation email
    // await sendInvitationEmail(data.email, data.token);
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string, organizationId: string): Promise<void> {
    const { error } = await supabase
      .from('team_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Accept invitation (when user signs up with invitation token)
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    const { data: invitation, error: fetchError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      throw new Error('Invitation has expired');
    }

    // Update user's organization and role
    const { error: updateError } = await supabase
      .from('users')
      .update({
        organization_id: invitation.organization_id,
        role: invitation.role,
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Mark invitation as accepted
    await supabase
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);
  }
}

export const teamService = new TeamService();

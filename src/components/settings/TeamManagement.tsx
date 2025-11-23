/**
 * Team Management Component
 *
 * SaaS-ready team management with:
 * - Team member list
 * - Role management (admin, user, viewer)
 * - Invite members
 * - Remove members
 * - Permission controls
 */

import { useState, useEffect } from 'react';
import apiClient from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  MoreVertical,
  Crown,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  joinedAt: string;
  lastActive?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

// =============================================
// COMPONENT
// =============================================

export default function TeamManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user' | 'viewer'>('user');
  const [inviting, setInviting] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadTeamData();
  }, []);

  async function loadTeamData() {
    setLoading(true);
    try {
      const [membersData, invitationsData] = await Promise.all([
        apiClient.get<TeamMember[]>('/team/members'),
        apiClient.get<Invitation[]>('/team/invitations'),
      ]);

      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteMember() {
    if (!inviteEmail) return;

    setInviting(true);
    try {
      await apiClient.post('/team/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      setInviteEmail('');
      setShowInviteModal(false);
      await loadTeamData();
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRole(memberId: string, newRole: 'admin' | 'user' | 'viewer') {
    try {
      await apiClient.patch(`/team/members/${memberId}/role`, { role: newRole });
      await loadTeamData();
    } catch (error) {
      console.error('Failed to change role:', error);
      alert('Failed to change role');
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      await apiClient.delete(`/team/members/${memberId}`);
      await loadTeamData();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  }

  async function handleResendInvitation(invitationId: string) {
    try {
      await apiClient.post(`/team/invitations/${invitationId}/resend`);
      alert('Invitation resent successfully');
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      alert('Failed to resend invitation');
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await apiClient.delete(`/team/invitations/${invitationId}`);
      await loadTeamData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation');
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'user':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-slate-600" />;
      default:
        return <Shield className="w-4 h-4 text-slate-600" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Admin</span>;
      case 'user':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">User</span>;
      case 'viewer':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Viewer</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
      case 'invited':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Invited</span>;
      case 'suspended':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Suspended</span>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Team Members</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your team and permissions
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{members.length}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total Members</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {members.filter((m) => m.status === 'active').length}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg">
              <Mail className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{invitations.length}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Pending Invites</p>
            </div>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Active Members</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Joined
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{member.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(member.role)}
                      {getRoleBadge(member.role)}
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(member.status)}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(member.joinedAt)}</p>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      {member.id !== user?.id && (
                        <div className="flex items-center justify-end space-x-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleChangeRole(member.id, e.target.value as any)}
                            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Pending Invitations</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{invitation.email}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Invited {formatDate(invitation.invitedAt)} • Expires {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getRoleBadge(invitation.role)}
                  {isAdmin && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                      >
                        Resend
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Invite Team Member</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="user">User - Can create and edit</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 rounded-b-xl flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteMember}
                disabled={inviting || !inviteEmail}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{inviting ? 'Sending...' : 'Send Invitation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

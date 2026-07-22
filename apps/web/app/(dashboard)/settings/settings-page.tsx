'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-fetch';

type MemberRole = 'OWNER' | 'ADMIN' | 'PHYSICIAN' | 'VIEWER';

interface Organization {
  id: string;
  name: string;
  type: string;
  plan: string;
}

interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
  joinedAt: string;
  user?: { email: string; name: string };
}

interface SettingsPageProps {
  organizationId: string;
  isOwner: boolean;
}

const ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'PHYSICIAN', 'VIEWER'];

export function SettingsPage({ organizationId, isOwner }: SettingsPageProps) {
  const [tab, setTab] = useState<'organization' | 'members'>('organization');

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('VIEWER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const fetchOrg = useCallback(async () => {
    setOrgLoading(true);
    setOrgError(null);
    try {
      const res = await apiFetch<{ data: Organization }>(`/v1/organizations/${organizationId}`);
      setOrg(res.data);
      setOrgName(res.data.name);
    } catch (e) {
      setOrgError((e as Error).message);
    } finally {
      setOrgLoading(false);
    }
  }, [organizationId]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await apiFetch<{ data: Member[] }>(`/v1/organizations/${organizationId}/members`);
      setMembers(res.data);
    } catch (e) {
      setMembersError((e as Error).message);
    } finally {
      setMembersLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    if (tab === 'members') {
      fetchMembers();
    }
  }, [tab, fetchMembers]);

  async function handleSaveOrg() {
    setSavingOrg(true);
    setOrgSaved(false);
    try {
      const res = await apiFetch<{ data: Organization }>(`/v1/organizations/${organizationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: orgName }),
      });
      setOrg(res.data);
      setOrgSaved(true);
    } catch (e) {
      setOrgError((e as Error).message);
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      await apiFetch(`/v1/organizations/${organizationId}/members/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      setInviteRole('VIEWER');
      setInviteSuccess(true);
      fetchMembers();
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    try {
      await apiFetch(`/v1/organizations/${organizationId}/members/${memberId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchMembers();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the organization?`)) return;
    try {
      await apiFetch(`/v1/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
      });
      fetchMembers();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-outline-variant">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab('organization')}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === 'organization'
                ? 'border-b-2 border-blue-600 text-secondary'
                : 'text-on-surface-variant hover:text-on-surface-variant'
            }`}
          >
            Organization
          </button>
          <button
            onClick={() => setTab('members')}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === 'members'
                ? 'border-b-2 border-blue-600 text-secondary'
                : 'text-on-surface-variant hover:text-on-surface-variant'
            }`}
          >
            Members
          </button>
        </nav>
      </div>

      {tab === 'organization' && (
        <div className="max-w-lg space-y-6">
          {orgLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-outline border-t-blue-600" />
            </div>
          ) : orgError ? (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {orgError}
              <Button variant="ghost" size="sm" onClick={fetchOrg} className="ml-4">Retry</Button>
            </div>
          ) : org ? (
            <>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant">Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-outline px-3 py-2 text-sm shadow-card focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant">Type</label>
                <input
                  type="text"
                  value={org.type}
                  disabled
                  className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface-variant"
                />
                <p className="mt-1 text-xs text-on-surface-variant/60">Organization type cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant">Plan</label>
                <input
                  type="text"
                  value={org.plan}
                  disabled
                  className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-surface-variant"
                />
              </div>

              {orgSaved && (
                <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  Settings saved successfully
                </div>
              )}

              <Button
                size="sm"
                onClick={handleSaveOrg}
                disabled={savingOrg || orgName === org.name}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingOrg ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : null}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-8">
          {isOwner && (
            <div className="max-w-lg rounded-lg border border-outline-variant bg-surface-lowest p-6 shadow-card">
              <h3 className="text-sm font-semibold text-on-surface">Invite Member</h3>
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="doctor@example.com"
                    className="mt-1 block w-full rounded-lg border border-outline px-3 py-2 text-sm shadow-card focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="mt-1 block w-full rounded-lg border border-outline px-3 py-2 text-sm shadow-card focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                {inviteError && (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    Invitation sent
                  </div>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={inviting || !inviteEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </form>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-on-surface">Current Members</h3>
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-outline border-t-blue-600" />
              </div>
            ) : membersError ? (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {membersError}
                <Button variant="ghost" size="sm" onClick={fetchMembers} className="ml-4">Retry</Button>
              </div>
            ) : members.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant/60">No members found</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest">
                <table className="min-w-full divide-y divide-outline-variant text-sm">
                  <thead className="bg-surface-low">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">Role</th>
                      {isOwner && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-4 py-3 text-on-surface">
                          {member.user?.name ?? member.userId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {member.user?.email ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isOwner && member.role !== 'OWNER' ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.userId, e.target.value as MemberRole)}
                              className="rounded border border-outline px-2 py-1 text-xs focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {member.role}
                            </span>
                          )}
                        </td>
                        {isOwner && (
                          <td className="px-4 py-3 text-right">
                            {member.role !== 'OWNER' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemoveMember(
                                    member.userId,
                                    member.user?.name ?? member.userId.slice(0, 8),
                                  )
                                }
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

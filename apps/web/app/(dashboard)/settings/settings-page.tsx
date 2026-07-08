'use client';

import { useState, useEffect, useCallback } from 'react';

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

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

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
      const data = await apiFetch<Organization>(`/v1/organizations/${organizationId}`);
      setOrg(data);
      setOrgName(data.name);
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
      const data = await apiFetch<Member[]>(`/v1/organizations/${organizationId}/members`);
      setMembers(data);
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
      const data = await apiFetch<Organization>(`/v1/organizations/${organizationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: orgName }),
      });
      setOrg(data);
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
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab('organization')}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === 'organization'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Organization
          </button>
          <button
            onClick={() => setTab('members')}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === 'members'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            </div>
          ) : orgError ? (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {orgError}
              <button onClick={fetchOrg} className="ml-4 underline">Retry</button>
            </div>
          ) : org ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <input
                  type="text"
                  value={org.type}
                  disabled
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-400">Organization type cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Plan</label>
                <input
                  type="text"
                  value={org.plan}
                  disabled
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>

              {orgSaved && (
                <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  Settings saved successfully
                </div>
              )}

              <button
                onClick={handleSaveOrg}
                disabled={savingOrg || orgName === org.name}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingOrg ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : null}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-8">
          {isOwner && (
            <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Invite Member</h3>
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="doctor@example.com"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </form>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Current Members</h3>
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              </div>
            ) : membersError ? (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {membersError}
                <button onClick={fetchMembers} className="ml-4 underline">Retry</button>
              </div>
            ) : members.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">No members found</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                      {isOwner && (
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-4 py-3 text-gray-900">
                          {member.user?.name ?? member.userId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {member.user?.email ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isOwner && member.role !== 'OWNER' ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.userId, e.target.value as MemberRole)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                              <button
                                onClick={() =>
                                  handleRemoveMember(
                                    member.userId,
                                    member.user?.name ?? member.userId.slice(0, 8),
                                  )
                                }
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
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

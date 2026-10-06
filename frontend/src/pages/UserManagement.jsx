import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/usersApi';

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tempPasswordModal, setTempPasswordModal] = useState({ open: false, password: '', userName: '' });
  const [formError, setFormError] = useState('');

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'COLLECTION',
  });

  // Query users
  const { data: usersData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['usersList', selectedRole, selectedStatus, searchTerm],
    queryFn: () => {
      const params = {};
      if (selectedRole !== 'ALL') params.role = selectedRole;
      if (selectedStatus === 'ACTIVE') params.is_active = true;
      if (selectedStatus === 'INACTIVE') params.is_active = false;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      return usersApi.getUsers(params);
    },
  });

  const users = usersData?.users || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => usersApi.createUser(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'COLLECTION' });
      setFormError('');
      if (res.tempPassword || res.temporary_password) {
        setTempPasswordModal({
          open: true,
          password: res.tempPassword || res.temporary_password,
          userName: res.user?.name || 'New User',
        });
      }
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      setShowEditModal(false);
      setCurrentUser(null);
      setFormError('');
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to update user');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id) => usersApi.resetPassword(id),
    onSuccess: (res, id) => {
      const targetUser = users.find((u) => u.id === id);
      setTempPasswordModal({
        open: true,
        password: res.tempPassword || res.temporary_password,
        userName: targetUser?.name || 'User',
      });
    },
    onError: (err) => {
      alert(err.message || 'Failed to reset password');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => usersApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
    },
    onError: (err) => {
      alert(err.message || 'Failed to deactivate user. User may have active batch assignments.');
    },
  });

  const handleAddUser = (e) => {
    e.preventDefault();
    setFormError('');
    createMutation.mutate(newUser);
  };

  const handleEditUser = (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError('');
    updateMutation.mutate({
      id: currentUser.id,
      data: { name: currentUser.name, is_active: currentUser.is_active },
    });
  };

  const handleToggleActive = (userToToggle) => {
    if (userToToggle.is_active) {
      if (confirm(`Are you sure you want to deactivate ${userToToggle.name}?`)) {
        deactivateMutation.mutate(userToToggle.id);
      }
    } else {
      updateMutation.mutate({ id: userToToggle.id, data: { is_active: true } });
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="text-xs font-semibold bg-primary-soft text-primary px-2.5 py-0.5 rounded-full">Admin</span>;
      case 'COLLECTION':
        return <span className="text-xs font-semibold bg-badge-collected-bg text-badge-collected-text px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">Collection</span>;
      case 'TRANSPORTATION':
        return <span className="text-xs font-semibold bg-badge-transit-bg text-badge-transit-text px-2.5 py-0.5 rounded-full border border-[#FDE68A]">Transportation</span>;
      case 'RTS':
        return <span className="text-xs font-semibold bg-badge-rts-bg text-badge-rts-text px-2.5 py-0.5 rounded-full border border-[#E9D5FF]">RTS</span>;
      case 'PROCESSING':
        return <span className="text-xs font-semibold bg-badge-completed-bg text-badge-completed-text px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">Processing</span>;
      case 'HEAD_OFFICER':
        return <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-border">Head Officer</span>;
      default:
        return <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">{role}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-page-title text-page-title text-text">Users</h1>
          <p className="font-body text-body text-text-muted mt-0.5">
            Manage user accounts, system roles, authentication status, and stage permissions.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
            setFormError('');
            setNewUser({ name: '', email: '', role: 'COLLECTION' });
          }}
          className="h-10 px-4 bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Add User</span>
        </button>
      </div>

      {/* Operational Rule Alert */}
      <div className="p-3.5 rounded-xl bg-warning-soft border border-warning/30 flex items-start gap-2.5 text-warning-800">
        <span className="material-symbols-outlined text-warning text-[20px] shrink-0 mt-0.5">info</span>
        <p className="font-caption text-caption text-[#854d0e] leading-relaxed">
          <strong className="font-semibold text-[#713f12]">Operational Rule:</strong> Multiple users per role permitted. Deactivating a user with active assigned batches requires reassigning those batches first.
        </p>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <span className="material-symbols-outlined text-text-disabled absolute left-3 top-2.5 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-surface text-text font-body text-body rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="h-9 px-3 bg-surface text-text font-body text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="COLLECTION">Collection</option>
            <option value="TRANSPORTATION">Transportation</option>
            <option value="RTS">RTS</option>
            <option value="PROCESSING">Processing</option>
            <option value="HEAD_OFFICER">Head Officer</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 bg-surface text-text font-body text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Deactivated</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedRole('ALL');
              setSelectedStatus('ALL');
            }}
            className="h-9 px-3 text-text-muted hover:text-text font-body-medium text-xs rounded-lg border border-border hover:bg-background transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset</span>
          </button>
        </div>

        <span className="font-caption text-caption text-text-muted whitespace-nowrap self-end sm:self-center">
          Showing {users.length} users
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
            <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
              progress_activity
            </span>
            <span className="text-sm">Loading users directory...</span>
          </div>
        )}

        {isError && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center p-4">
            <span className="material-symbols-outlined text-error text-[32px]">error</span>
            <span className="text-sm text-text font-medium">{error?.message || 'Failed to load users'}</span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 bg-surface border border-border text-sm rounded-lg hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Name</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Email</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Role</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Status</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Last Login</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-text-muted font-body text-sm">
                      No users found matching current filters.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const initials = u.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-border flex items-center justify-center font-semibold text-xs text-text-muted shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-body-medium text-body-medium text-text block font-medium">
                                {u.name}
                              </span>
                              {u.must_change_password && (
                                <span className="text-[10px] text-amber-600 font-semibold block">
                                  Password change required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-body text-body text-text-muted font-mono text-xs">
                          {u.email}
                        </td>

                        <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>

                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#DCFCE7] text-[#15803D] border border-[#A7F3D0]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]"></span>
                              Deactivated
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-body text-xs text-text-muted">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setCurrentUser(u);
                                setFormError('');
                                setShowEditModal(true);
                              }}
                              className="p-1 rounded text-text-muted hover:text-primary hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit User"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>

                            <button
                              onClick={() => resetPasswordMutation.mutate(u.id)}
                              className="p-1 rounded text-text-muted hover:text-amber-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                            </button>

                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                u.is_active
                                  ? 'text-text-muted hover:text-error hover:bg-red-50'
                                  : 'text-text-muted hover:text-primary hover:bg-green-50'
                              }`}
                              title={u.is_active ? 'Deactivate User' : 'Activate User'}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {u.is_active ? 'block' : 'check_circle'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-[480px] w-full p-6 flex flex-col gap-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">Create New User</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="userName">
                  Full Name <span className="text-error">*</span>
                </label>
                <input
                  id="userName"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kulkarni"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="userEmail">
                  Email Address <span className="text-error">*</span>
                </label>
                <input
                  id="userEmail"
                  type="email"
                  required
                  placeholder="name@cleanwaste.org"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="userRole">
                  System Role <span className="text-error">*</span>
                </label>
                <select
                  id="userRole"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="COLLECTION">Collection</option>
                  <option value="TRANSPORTATION">Transportation</option>
                  <option value="RTS">RTS</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="ADMIN">Admin</option>
                  <option value="HEAD_OFFICER">Head Officer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="h-10 px-5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer disabled:opacity-75"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Password Display Modal */}
      {tempPasswordModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-[480px] w-full p-6 flex flex-col gap-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">
                Password Issued for {tempPasswordModal.userName}
              </h3>
              <button
                type="button"
                onClick={() => setTempPasswordModal({ open: false, password: '', userName: '' })}
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-primary-soft border border-primary/30 flex flex-col gap-2">
              <span className="font-caption text-caption text-primary font-semibold uppercase">
                Temporary Password Generated
              </span>
              <div className="font-mono text-base font-bold text-text bg-white p-3 rounded-lg border border-border flex items-center justify-between">
                <span>{tempPasswordModal.password}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(tempPasswordModal.password)}
                  className="text-xs text-primary hover:underline font-sans font-medium cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <p className="font-caption text-caption text-text-muted mt-1">
                Provide this temporary password to the user. They will be forced to change it on their first login.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTempPasswordModal({ open: false, password: '', userName: '' })}
              className="w-full h-10 bg-primary text-white rounded-lg font-body-medium text-body-medium hover:bg-primary-hover transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-[460px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">Edit User</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditUser} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="editName">
                  Full Name
                </label>
                <input
                  id="editName"
                  type="text"
                  required
                  value={currentUser.name}
                  onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="editActive"
                  type="checkbox"
                  checked={currentUser.is_active}
                  onChange={(e) => setCurrentUser({ ...currentUser, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="editActive" className="text-sm text-text font-medium">
                  Active Account
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="h-10 px-5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium shadow-xs cursor-pointer disabled:opacity-75"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

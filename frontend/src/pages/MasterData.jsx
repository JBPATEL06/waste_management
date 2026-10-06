import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterApi } from '../api/masterApi';

const TAB_TO_TYPE = {
  routes: 'routes',
  vehicles: 'vehicles',
  rts: 'rts-locations',
  facilities: 'processing-facilities',
  processTypes: 'process-types',
  categories: 'waste-categories',
  drivers: 'drivers',
};

export default function MasterData() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('routes');
  const [search, setSearch] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [modalError, setModalError] = useState('');

  const currentType = TAB_TO_TYPE[activeTab];

  // Query master records
  const { data: masterData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['masterItems', activeTab, search],
    queryFn: () => masterApi.getItems(currentType, { search: search.trim() || undefined }),
  });

  const items = masterData?.items || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => masterApi.createItem(currentType, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterItems', activeTab] });
      setShowModal(false);
      setFormData({});
      setModalError('');
    },
    onError: (err) => {
      setModalError(err.message || 'Failed to create record');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => masterApi.updateItem(currentType, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterItems', activeTab] });
      setShowModal(false);
      setEditingItem(null);
      setModalError('');
    },
    onError: (err) => {
      setModalError(err.message || 'Failed to update record');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => masterApi.deactivateItem(currentType, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterItems', activeTab] });
    },
    onError: (err) => {
      alert(err.message || 'Failed to toggle status');
    },
  });

  const tabs = [
    { key: 'routes', label: 'Routes', icon: 'alt_route' },
    { key: 'vehicles', label: 'Vehicles', icon: 'local_shipping' },
    { key: 'rts', label: 'RTS Locations', icon: 'warehouse' },
    { key: 'facilities', label: 'Processing Facilities', icon: 'factory' },
    { key: 'processTypes', label: 'Process Types', icon: 'settings_suggest' },
    { key: 'categories', label: 'Waste Categories', icon: 'category' },
    { key: 'drivers', label: 'Drivers & Supervisors', icon: 'badge' },
  ];

  const handleOpenAdd = () => {
    setModalMode('add');
    setEditingItem(null);
    setFormData({});
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setModalMode('edit');
    setEditingItem(item);
    setFormData({ ...item });
    setModalError('');
    setShowModal(true);
  };

  const handleToggleActive = (item) => {
    if (item.is_active) {
      if (confirm(`Deactivate "${item.name || item.vehicle_number || item.code}"?`)) {
        deactivateMutation.mutate(item.id);
      }
    } else {
      updateMutation.mutate({ id: item.id, data: { is_active: true } });
    }
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    setModalError('');

    let payload = {};
    if (activeTab === 'routes') {
      payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description || '',
      };
    } else if (activeTab === 'vehicles') {
      payload = {
        vehicle_number: (formData.vehicle_number || formData.vehicleNumber || '').toUpperCase(),
        vehicle_type: formData.vehicle_type || formData.vehicleType || 'Tipper',
        capacity_kg: parseFloat(formData.capacity_kg || formData.capacityKg || 5000),
      };
    } else if (activeTab === 'rts' || activeTab === 'facilities') {
      payload = {
        name: formData.name,
        location: formData.location || '',
      };
    } else if (activeTab === 'processTypes' || activeTab === 'categories') {
      payload = {
        name: formData.name,
        description: formData.description || '',
      };
    } else if (activeTab === 'drivers') {
      payload = {
        name: formData.name,
        phone: formData.phone || '',
        license_number: formData.license_number || formData.licenseNumber || 'MH-LIC-0000',
      };
    }

    if (modalMode === 'add') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-page-title text-page-title text-text">Master Data Configuration</h1>
          <p className="font-body text-body text-text-muted mt-0.5">
            Maintain municipal reference entities, vehicles, designated transfer stations, and process categories.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="h-10 px-4 bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Add Record</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSearch('');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-body-medium text-body-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary font-semibold bg-primary-soft/30'
                : 'text-text-muted hover:text-text hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search & Action Bar */}
      <div className="flex items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined text-text-disabled absolute left-3 top-2 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 bg-surface text-text font-body text-body rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
        </div>
        <span className="font-caption text-caption text-text-muted">
          Showing {items.length} records
        </span>
      </div>

      {/* Table Card */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
            <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
              progress_activity
            </span>
            <span className="text-sm">Loading master records...</span>
          </div>
        )}

        {isError && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center p-4">
            <span className="material-symbols-outlined text-error text-[32px]">error</span>
            <span className="text-sm text-text font-medium">{error?.message || 'Failed to load records'}</span>
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
            <table className="w-full text-left">
              <thead>
                <tr className="bg-background text-text-muted font-label text-label border-b border-border">
                  <th className="py-3.5 pl-6 pr-4">Identifier / Name</th>
                  <th className="py-3.5 px-4">Details / Attributes</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 pr-6 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-body text-body">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-text-muted font-body text-sm">
                      No records found matching current query.
                    </td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 pl-6 pr-4 font-mono font-semibold text-text">
                        {r.code || r.vehicle_number || r.name}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted">
                        {r.description ||
                          r.location ||
                          (r.vehicle_type ? `${r.vehicle_type} (${r.capacity_kg} kg)` : null) ||
                          (r.phone ? `Phone: ${r.phone}` : null) ||
                          '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {r.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#DCFCE7] text-[#15803D] border border-[#A7F3D0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#F1F5F9] text-[#64748B] border border-border">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pr-6 pl-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="text-text-muted hover:text-primary p-1 cursor-pointer"
                            title="Edit Record"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleActive(r)}
                            className="text-text-muted hover:text-error p-1 cursor-pointer"
                            title={r.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {r.is_active ? 'block' : 'check_circle'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-[480px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">
                {modalMode === 'add' ? 'Add New Record' : 'Edit Record'} ({tabs.find((t) => t.key === activeTab)?.label})
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveModal} className="flex flex-col gap-4">
              {activeTab === 'routes' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="routeCode">
                      Route Code *
                    </label>
                    <input
                      id="routeCode"
                      type="text"
                      required
                      placeholder="e.g. R-01"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body font-mono uppercase"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="routeName">
                      Route Name *
                    </label>
                    <input
                      id="routeName"
                      type="text"
                      required
                      placeholder="e.g. Zone 4 Commercial Loop"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="routeDesc">
                      Description
                    </label>
                    <input
                      id="routeDesc"
                      type="text"
                      placeholder="Coverage notes"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                </>
              )}

              {activeTab === 'vehicles' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="vehicleNumber">
                      Vehicle Number *
                    </label>
                    <input
                      id="vehicleNumber"
                      type="text"
                      required
                      placeholder="e.g. MH-02-CW-4091"
                      value={formData.vehicle_number || formData.vehicleNumber || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body uppercase font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="vehicleType">
                      Vehicle Type *
                    </label>
                    <input
                      id="vehicleType"
                      type="text"
                      required
                      placeholder="e.g. Compactor"
                      value={formData.vehicle_type || formData.vehicleType || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="vehicleCapacity">
                      Capacity (kg) *
                    </label>
                    <input
                      id="vehicleCapacity"
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      value={formData.capacity_kg || formData.capacityKg || ''}
                      onChange={(e) => setFormData({ ...formData, capacity_kg: parseFloat(e.target.value) })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                </>
              )}

              {(activeTab === 'rts' || activeTab === 'facilities') && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="facilityName">
                      Name *
                    </label>
                    <input
                      id="facilityName"
                      type="text"
                      required
                      placeholder="Facility name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="facilityLocation">
                      Location / Address *
                    </label>
                    <input
                      id="facilityLocation"
                      type="text"
                      required
                      placeholder="Address or area"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                </>
              )}

              {(activeTab === 'processTypes' || activeTab === 'categories') && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="commonName">
                      Name *
                    </label>
                    <input
                      id="commonName"
                      type="text"
                      required
                      placeholder="Category / Type name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="commonDesc">
                      Description
                    </label>
                    <input
                      id="commonDesc"
                      type="text"
                      placeholder="Description"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                </>
              )}

              {activeTab === 'drivers' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="driverName">
                      Name *
                    </label>
                    <input
                      id="driverName"
                      type="text"
                      required
                      placeholder="Full Name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="driverPhone">
                      Phone Number *
                    </label>
                    <input
                      id="driverPhone"
                      type="text"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body font-mono text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted" htmlFor="driverLic">
                      License Number *
                    </label>
                    <input
                      id="driverLic"
                      type="text"
                      required
                      placeholder="MH-02-2020-00123"
                      value={formData.license_number || formData.licenseNumber || ''}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body font-mono text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="h-10 px-5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium shadow-xs cursor-pointer disabled:opacity-75"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

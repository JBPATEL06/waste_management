import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
const StageLayout = lazy(() => import('./components/layout/StageLayout'));
const HeadOfficerLayout = lazy(() => import('./components/layout/HeadOfficerLayout'));

// Public Pages
const Login = lazy(() => import('./pages/Login'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const PublicSearch = lazy(() => import('./pages/PublicSearch'));
const PublicTracking = lazy(() => import('./pages/PublicTracking'));
const AccessDenied403 = lazy(() => import('./pages/AccessDenied403'));
const NotFound404 = lazy(() => import('./pages/NotFound404'));

// Profile Page
const Profile = lazy(() => import('./pages/Profile'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BatchList = lazy(() => import('./pages/BatchList'));
const CreateBatch = lazy(() => import('./pages/CreateBatch'));
const BatchDetail = lazy(() => import('./pages/BatchDetail'));
const MasterData = lazy(() => import('./pages/MasterData'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ExportData = lazy(() => import('./pages/ExportData'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Settings = lazy(() => import('./pages/Settings'));

// Stage Operational Pages
const StageDashboard = lazy(() => import('./pages/stage/StageDashboard'));
const StageBatchView = lazy(() => import('./pages/stage/StageBatchView'));
const StageEntryForm = lazy(() => import('./pages/stage/StageEntryForm'));
const StageHistory = lazy(() => import('./pages/stage/StageHistory'));

// Head Officer Pages
const HeadOfficerDashboard = lazy(() => import('./pages/ho/HeadOfficerDashboard'));
const HeadOfficerBatchList = lazy(() => import('./pages/ho/HeadOfficerBatchList'));
const HeadOfficerBatchDetail = lazy(() => import('./pages/ho/HeadOfficerBatchDetail'));

// Root Redirect Helper
function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
            progress_activity
          </span>
          <span className="text-sm font-medium">Loading portal...</span>
        </div>
      </div>
    );
  }

  if (user) {
    if (user.must_change_password) return <Navigate to="/change-password" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'HEAD_OFFICER') return <Navigate to="/ho/dashboard" replace />;
    if (user.role === 'COLLECTION') return <Navigate to="/collection/dashboard" replace />;
    if (user.role === 'TRANSPORTATION') return <Navigate to="/transportation/dashboard" replace />;
    if (user.role === 'RTS') return <Navigate to="/rts/dashboard" replace />;
    if (user.role === 'PROCESSING') return <Navigate to="/processing/dashboard" replace />;
    return <Navigate to="/profile" replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="flex items-center gap-3 text-text-muted">
                <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
                  progress_activity
                </span>
                <span className="text-sm font-medium">Loading portal...</span>
              </div>
            </div>
          }
        >
          <Routes>
            {/* Root Redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public & Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route path="/track" element={<PublicSearch />} />
            <Route path="/track/:batchCode" element={<PublicTracking />} />
            <Route path="/403" element={<AccessDenied403 />} />
            <Route path="/404" element={<NotFound404 />} />

            {/* User Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Admin Nested Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="batches" element={<BatchList />} />
              <Route path="batches/new" element={<CreateBatch />} />
              <Route path="batches/:code" element={<BatchDetail />} />
              <Route path="master" element={<MasterData />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="export" element={<ExportData />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Collection Stage Panel */}
            <Route
              path="/collection"
              element={
                <ProtectedRoute allowedRoles={['COLLECTION']}>
                  <StageLayout currentRole="collection" />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StageDashboard role="collection" />} />
              <Route path="batches/:code" element={<StageBatchView role="collection" />} />
              <Route path="batches/:code/entry" element={<StageEntryForm role="collection" />} />
              <Route path="history" element={<StageHistory role="collection" />} />
            </Route>

            {/* Transportation Stage Panel */}
            <Route
              path="/transportation"
              element={
                <ProtectedRoute allowedRoles={['TRANSPORTATION']}>
                  <StageLayout currentRole="transportation" />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StageDashboard role="transportation" />} />
              <Route path="batches/:code" element={<StageBatchView role="transportation" />} />
              <Route path="batches/:code/entry" element={<StageEntryForm role="transportation" />} />
              <Route path="history" element={<StageHistory role="transportation" />} />
            </Route>

            {/* RTS Stage Panel */}
            <Route
              path="/rts"
              element={
                <ProtectedRoute allowedRoles={['RTS']}>
                  <StageLayout currentRole="rts" />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StageDashboard role="rts" />} />
              <Route path="batches/:code" element={<StageBatchView role="rts" />} />
              <Route path="batches/:code/entry" element={<StageEntryForm role="rts" />} />
              <Route path="history" element={<StageHistory role="rts" />} />
            </Route>

            {/* Processing Stage Panel */}
            <Route
              path="/processing"
              element={
                <ProtectedRoute allowedRoles={['PROCESSING']}>
                  <StageLayout currentRole="processing" />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StageDashboard role="processing" />} />
              <Route path="batches/:code" element={<StageBatchView role="processing" />} />
              <Route path="batches/:code/entry" element={<StageEntryForm role="processing" />} />
              <Route path="history" element={<StageHistory role="processing" />} />
            </Route>

            {/* Head Officer Panel */}
            <Route
              path="/ho"
              element={
                <ProtectedRoute allowedRoles={['HEAD_OFFICER']}>
                  <HeadOfficerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<HeadOfficerDashboard />} />
              <Route path="batches" element={<HeadOfficerBatchList />} />
              <Route path="batches/:code" element={<HeadOfficerBatchDetail />} />
              <Route path="export" element={<ExportData />} />
              <Route path="audit" element={<AuditLog />} />
            </Route>

            {/* 404 Catch-All */}
            <Route path="*" element={<NotFound404 />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

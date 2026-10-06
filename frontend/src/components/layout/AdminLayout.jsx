import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '../common/TopBar';
import Sidebar from '../common/Sidebar';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-text font-body">
      <TopBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="pl-0 lg:pl-[240px] transition-[padding] duration-200">
        <main className="pt-14 min-h-screen bg-background">
          <div className="max-w-[1440px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}


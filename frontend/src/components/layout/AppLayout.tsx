import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from '@/components/ui/sonner';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

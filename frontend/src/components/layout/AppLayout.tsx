import { Outlet } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { LogOut, Droplets } from 'lucide-react';
import Sidebar from './Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { getUser, clearAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

function MobileHeader() {
  const navigate = useNavigate();
  const user = getUser();
  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground border-b">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Droplets className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-semibold text-sm">La Montana</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-sidebar-foreground/70">{user?.full_name}</span>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-sidebar-foreground/60" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

export default function AppLayout() {
  const user = getUser();
  const isDeliveryUser = user?.role === 'delivery';

  return (
    <div className="flex min-h-screen">
      {/* Hide sidebar on mobile for delivery users, show on md+ always */}
      <div className={isDeliveryUser ? 'hidden md:block' : ''}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-auto">
        {isDeliveryUser && <MobileHeader />}
        <main className="flex-1">
          <div className={isDeliveryUser ? 'p-4 md:p-8' : 'p-8'}>
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

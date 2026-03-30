import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  UserCircle,
  Cylinder,
  Factory,
  Warehouse,
  ShoppingCart,
  CreditCard,
  Truck,
  Wallet,
  LogOut,
  Droplets,
  Settings,
} from 'lucide-react';
import { clearAuth, getUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type Role = 'admin' | 'secretary' | 'delivery';

const navItems: { to: string; icon: typeof LayoutDashboard; label: string; roles: Role[] }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'secretary'] },
  { to: '/employees', icon: Users, label: 'Empleados', roles: ['admin'] },
  { to: '/products', icon: Package, label: 'Productos', roles: ['admin', 'secretary'] },
  { to: '/clients', icon: UserCircle, label: 'Clientes', roles: ['admin', 'secretary'] },
  { to: '/bobinas', icon: Cylinder, label: 'Bobinas', roles: ['admin'] },
  { to: '/production', icon: Factory, label: 'Produccion', roles: ['admin', 'secretary'] },
  { to: '/inventory', icon: Warehouse, label: 'Inventario', roles: ['admin', 'secretary'] },
  { to: '/sales', icon: ShoppingCart, label: 'Ventas', roles: ['admin', 'secretary'] },
  { to: '/receivables', icon: CreditCard, label: 'Cuentas x Cobrar', roles: ['admin', 'secretary'] },
  { to: '/deliveries', icon: Truck, label: 'Repartos', roles: ['admin', 'secretary', 'delivery'] },
  { to: '/payroll', icon: Wallet, label: 'Nomina', roles: ['admin'] },
  { to: '/settings', icon: Settings, label: 'Configuracion', roles: ['admin'] },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Droplets className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-base leading-tight">La Montana</h1>
            <p className="text-xs text-sidebar-foreground/60">Sistema ERP</p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 p-3 space-y-1">
        {navItems.filter(item => item.roles.includes((user?.role || 'admin') as Role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-xs font-medium">
            {user?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name || 'Admin'}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role || 'admin'}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar sesion
        </Button>
      </div>
    </aside>
  );
}

import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Receipt,
  HandCoins,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import { clearAuth, getUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type Role = 'admin' | 'secretary' | 'delivery';

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; roles: Role[] };
type NavSection = { title: string; icon: typeof LayoutDashboard; roles: Role[]; collapsible?: boolean; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: 'General',
    icon: LayoutDashboard,
    roles: ['admin', 'secretary', 'delivery'],
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'secretary'] },
    ],
  },
  {
    title: 'Produccion',
    icon: Factory,
    roles: ['admin', 'secretary'],
    collapsible: true,
    items: [
      { to: '/products', icon: Package, label: 'Productos', roles: ['admin', 'secretary'] },
      { to: '/bobinas', icon: Cylinder, label: 'Bobinas', roles: ['admin'] },
      { to: '/production', icon: Factory, label: 'Produccion', roles: ['admin', 'secretary'] },
      { to: '/inventory', icon: Warehouse, label: 'Inventario', roles: ['admin', 'secretary'] },
    ],
  },
  {
    title: 'Ventas',
    icon: ShoppingCart,
    roles: ['admin', 'secretary', 'delivery'],
    collapsible: true,
    items: [
      { to: '/clients', icon: UserCircle, label: 'Clientes', roles: ['admin', 'secretary'] },
      { to: '/sales', icon: ShoppingCart, label: 'Ventas', roles: ['admin', 'secretary'] },
      { to: '/receivables', icon: CreditCard, label: 'Cuentas x Cobrar', roles: ['admin', 'secretary'] },
      { to: '/deliveries', icon: Truck, label: 'Repartos', roles: ['admin', 'secretary', 'delivery'] },
    ],
  },
  {
    title: 'Finanzas',
    icon: BarChart3,
    roles: ['admin'],
    collapsible: true,
    items: [
      { to: '/expenses', icon: Receipt, label: 'Gastos', roles: ['admin'] },
      { to: '/other-income', icon: HandCoins, label: 'Otros Ingresos', roles: ['admin'] },
      { to: '/finance-kpis', icon: BarChart3, label: 'KPIs Financieros', roles: ['admin'] },
    ],
  },
  {
    title: 'RR.HH.',
    icon: Users,
    roles: ['admin'],
    collapsible: true,
    items: [
      { to: '/employees', icon: Users, label: 'Empleados', roles: ['admin'] },
      { to: '/payroll', icon: Wallet, label: 'Nomina', roles: ['admin'] },
    ],
  },
  {
    title: 'Sistema',
    icon: Settings,
    roles: ['admin'],
    collapsible: true,
    items: [
      { to: '/settings', icon: Settings, label: 'Configuracion', roles: ['admin'] },
    ],
  },
];

function sectionHasActiveRoute(section: NavSection, pathname: string) {
  return section.items.some(item =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const role = (user?.role || 'admin') as Role;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach(s => {
      if (s.collapsible) {
        initial[s.title] = !sectionHasActiveRoute(s, location.pathname);
      }
    });
    return initial;
  });

  const toggle = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));
  };

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

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navSections
          .filter(section => section.roles.includes(role))
          .map((section) => {
            const visibleItems = section.items.filter(item => item.roles.includes(role));
            if (visibleItems.length === 0) return null;

            const isCollapsed = !!collapsed[section.title];
            const isCollapsible = !!section.collapsible;
            const SectionIcon = section.icon;

            return (
              <div key={section.title}>
                {isCollapsible ? (
                  <button
                    onClick={() => toggle(section.title)}
                    className="w-full flex items-center justify-between px-3 py-2 mt-1 rounded-lg text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <SectionIcon className="w-3.5 h-3.5" />
                      {section.title}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                ) : null}

                {(!isCollapsible || !isCollapsed) && (
                  <div className={isCollapsible ? 'ml-1' : ''}>
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

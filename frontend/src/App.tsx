import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getUser } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Employees from '@/pages/Employees';
import Products from '@/pages/Products';
import Clients from '@/pages/Clients';
import Bobinas from '@/pages/Bobinas';
import Production from '@/pages/Production';
import Inventory from '@/pages/Inventory';
import Sales from '@/pages/Sales';
import Quotes from '@/pages/Quotes';
import Receivables from '@/pages/Receivables';
import Deliveries from '@/pages/Deliveries';

import Settings from '@/pages/Settings';
import Expenses from '@/pages/Expenses';
import OtherIncome from '@/pages/OtherIncome';
import FinanceKPIs from '@/pages/FinanceKPIs';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={getUser()?.role === 'delivery' ? <Navigate to="/deliveries" replace /> : <Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="products" element={<Products />} />
          <Route path="clients" element={<Clients />} />
          <Route path="bobinas" element={<Bobinas />} />
          <Route path="production" element={<Production />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="sales" element={<Sales />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="receivables" element={<Receivables />} />
          <Route path="deliveries" element={<Deliveries />} />

          <Route path="expenses" element={<Expenses />} />
          <Route path="other-income" element={<OtherIncome />} />
          <Route path="finance-kpis" element={<FinanceKPIs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

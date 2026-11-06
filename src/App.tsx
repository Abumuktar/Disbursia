import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppState } from './lib/store';
import { Layout } from './components/Layout';
import { Toaster } from './components/toast';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import NewDisbursement from './pages/NewDisbursement';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import Approvals from './pages/Approvals';
import Receipt from './pages/Receipt';
import AuditTrail from './pages/AuditTrail';
import Programmes from './pages/Programmes';
import Settings from './pages/Settings';

export default function App() {
  const signedIn = useAppState((s) => s.sessionUserId);
  return (
    <HashRouter>
      <Toaster />
      {!signedIn ? (
        <Routes>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="login" element={<Navigate to="/" replace />} />
          <Route path="/receipt/:batchId/:itemId" element={<Receipt />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="disburse" element={<NewDisbursement />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="batches" element={<Batches />} />
            <Route path="batches/:id" element={<BatchDetail />} />
            <Route path="programmes" element={<Programmes />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </HashRouter>
  );
}

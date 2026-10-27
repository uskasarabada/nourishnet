import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { StoreProvider } from './state/store';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Plan } from './pages/Plan';
import { Drives } from './pages/Drives';
import { DriveDetails } from './pages/DriveDetails';
import { Shelters } from './pages/Shelters';
import { Match } from './pages/Match';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="plan" element={<Plan />} />
            <Route path="drives" element={<Drives />} />
            <Route path="drives/:id" element={<DriveDetails />} />
            <Route path="shelters" element={<Shelters />} />
            <Route path="match" element={<Match />} />
            {/* Old routes from the earlier version */}
            <Route path="predict" element={<Navigate to="/plan" replace />} />
            <Route path="create" element={<Navigate to="/plan#create" replace />} />
            <Route path="map" element={<Navigate to="/drives" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
);

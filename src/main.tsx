import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { StoreProvider } from './state/store';
import { EmergencyProvider, Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { MapPage } from './pages/MapPage';
import { Predict } from './pages/Predict';
import { Shelters } from './pages/Shelters';
import { CreateDrive } from './pages/CreateDrive';
import { DriveDetails } from './pages/DriveDetails';
import { Match } from './pages/Match';
import { Impact } from './pages/Impact';
import { Profile } from './pages/Profile';
import { Volunteer } from './pages/Volunteer';
import { Report } from './pages/Report';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <EmergencyProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Landing />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="map" element={<MapPage />} />
              <Route path="predict" element={<Predict />} />
              <Route path="shelters" element={<Shelters />} />
              <Route path="create" element={<CreateDrive />} />
              <Route path="drives/:id" element={<DriveDetails />} />
              <Route path="drives/:id/report" element={<Report />} />
              <Route path="match" element={<Match />} />
              <Route path="impact" element={<Impact />} />
              <Route path="volunteer" element={<Volunteer />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </EmergencyProvider>
    </StoreProvider>
  </StrictMode>,
);

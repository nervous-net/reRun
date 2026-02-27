// ABOUTME: Root React component with router setup
// ABOUTME: Defines top-level routes for all reRun screens

import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { LoadingScreen } from './components/common/LoadingScreen';
import { Dashboard } from './components/dashboard/Dashboard';
import { ImportWizard } from './components/import/ImportWizard';
import { CustomerSearch } from './components/customers/CustomerSearch';
import { InventoryBrowser } from './components/inventory/InventoryBrowser';
import { POSScreen } from './components/pos/POSScreen';
import { ReturnScreen } from './components/rentals/ReturnScreen';
import { SettingsPage } from './components/settings/SettingsPage';
import { ThemePreviewPage } from './components/themes/ThemePreviewPage';

export function App() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <LoadingScreen onComplete={() => setReady(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/option-a" element={<ThemePreviewPage themeId="a" />} />
        <Route path="/option-b" element={<ThemePreviewPage themeId="b" />} />
        <Route path="/option-c" element={<ThemePreviewPage themeId="c" />} />
        <Route path="/option-d" element={<ThemePreviewPage themeId="d" />} />
        <Route path="/option-e" element={<ThemePreviewPage themeId="e" />} />
        <Route path="/option-f" element={<ThemePreviewPage themeId="f" />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POSScreen />} />
              <Route path="/customers" element={<CustomerSearch />} />
              <Route path="/returns" element={<ReturnScreen />} />
              <Route path="/inventory" element={<InventoryBrowser />} />
              <Route path="/import" element={<ImportWizard />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}

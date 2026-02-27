// ABOUTME: Root React component with router setup
// ABOUTME: Defines top-level routes for all reRun screens

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/common/Layout';

function PlaceholderPage({ name }: { name: string }) {
  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{ color: 'var(--crt-green)', textShadow: 'var(--glow-green)' }}>{name}</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Coming soon...</p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PlaceholderPage name="Dashboard" />} />
          <Route path="/pos" element={<PlaceholderPage name="Point of Sale" />} />
          <Route path="/customers" element={<PlaceholderPage name="Customers" />} />
          <Route path="/returns" element={<PlaceholderPage name="Returns" />} />
          <Route path="/inventory" element={<PlaceholderPage name="Inventory" />} />
          <Route path="/import" element={<PlaceholderPage name="Import" />} />
          <Route path="/settings" element={<PlaceholderPage name="Settings" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

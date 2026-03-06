// ABOUTME: Help modal with tabbed Quick Start, Features, and FAQ sections
// ABOUTME: Full-screen overlay accessible from Settings and Dashboard welcome banner

import { type CSSProperties, useState } from 'react';
import { Modal } from '../common/Modal';

type HelpTab = 'start' | 'features' | 'faq';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: HelpTab;
}

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: '0',
  borderBottom: '1px solid var(--border-color)',
  marginBottom: 'var(--space-md)',
};

const tabStyle: CSSProperties = {
  padding: 'var(--space-xs) var(--space-md)',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--text-secondary)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-md)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  cursor: 'pointer',
  transition: 'color 0.15s ease, border-color 0.15s ease',
};

const tabActiveStyle: CSSProperties = {
  color: 'var(--crt-green)',
  borderBottomColor: 'var(--crt-green)',
  textShadow: '0 0 10px var(--accent-50)',
};

const sectionTitleStyle: CSSProperties = {
  color: 'var(--crt-amber)',
  textShadow: 'var(--glow-amber)',
  fontSize: 'var(--font-size-lg)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '1px',
  marginTop: 'var(--space-lg)',
  marginBottom: 'var(--space-sm)',
};

const stepNumberStyle: CSSProperties = {
  display: 'inline-block',
  width: '24px',
  height: '24px',
  lineHeight: '24px',
  textAlign: 'center',
  border: '1px solid var(--crt-green)',
  borderRadius: 'var(--border-radius)',
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-sm)',
  marginRight: 'var(--space-sm)',
  flexShrink: 0,
};

const stepRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: 'var(--space-md)',
};

const stepTextStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
  lineHeight: 1.5,
};

const stepTitleStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontWeight: 'bold',
};

const descStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
  lineHeight: 1.5,
  marginBottom: 'var(--space-sm)',
};

const kbdStyle: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--crt-green)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-md)',
  marginTop: 'var(--space-sm)',
  marginBottom: 'var(--space-md)',
};

const thStyle: CSSProperties = {
  color: 'var(--crt-green)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontSize: 'var(--font-size-sm)',
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--crt-green-dim)',
};

const tdStyle: CSSProperties = {
  color: 'var(--text-primary)',
  padding: '4px 8px',
  borderBottom: '1px solid var(--border-color)',
};

const featureBlockStyle: CSSProperties = {
  marginBottom: 'var(--space-md)',
  padding: 'var(--space-sm) var(--space-md)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  backgroundColor: 'var(--accent-02)',
};

const featureTitleStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-md)',
  fontWeight: 'bold',
  marginBottom: 'var(--space-xs)',
};

const faqQuestionStyle: CSSProperties = {
  color: 'var(--crt-cyan)',
  fontSize: 'var(--font-size-md)',
  fontWeight: 'bold',
  marginBottom: 'var(--space-xs)',
  marginTop: 'var(--space-md)',
};

const faqAnswerStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
  lineHeight: 1.5,
  paddingLeft: 'var(--space-md)',
  marginBottom: 'var(--space-sm)',
};

function Kbd({ children }: { children: string }) {
  return <span style={kbdStyle}>{children}</span>;
}

function QuickStartTab() {
  return (
    <div>
      <div style={{ ...descStyle, marginBottom: 'var(--space-md)' }}>
        Get your store up and running in 5 steps:
      </div>

      <div style={stepRowStyle}>
        <span style={stepNumberStyle}>1</span>
        <div style={stepTextStyle}>
          <span style={stepTitleStyle}>Set Up Your Store</span>
          <br />
          Go to Settings (<Kbd>F10</Kbd>), enter your store name, phone, address, and tax rate. Hit Save Settings at the bottom.
        </div>
      </div>

      <div style={stepRowStyle}>
        <span style={stepNumberStyle}>2</span>
        <div style={stepTextStyle}>
          <span style={stepTitleStyle}>Add Rental Pricing</span>
          <br />
          In Settings, scroll to Rental Types &amp; Pricing. Create at least one pricing rule (e.g. "1-Night DVD" at $3.99). This determines what you charge for rentals.
        </div>
      </div>

      <div style={stepRowStyle}>
        <span style={stepNumberStyle}>3</span>
        <div style={stepTextStyle}>
          <span style={stepTitleStyle}>Import Your Catalog</span>
          <br />
          Go to Import (<Kbd>F5</Kbd>), upload a CSV of your titles, map the columns, review &amp; import. Copies are created automatically.
        </div>
      </div>

      <div style={stepRowStyle}>
        <span style={stepNumberStyle}>4</span>
        <div style={stepTextStyle}>
          <span style={stepTitleStyle}>Create a Customer</span>
          <br />
          Go to Customers (<Kbd>F2</Kbd>), click New Customer, fill in their details. Customers are required for rentals.
        </div>
      </div>

      <div style={stepRowStyle}>
        <span style={stepNumberStyle}>5</span>
        <div style={stepTextStyle}>
          <span style={stepTitleStyle}>Your First Rental</span>
          <br />
          Go to POS (<Kbd>F1</Kbd>), search or scan a customer barcode, then search or scan titles to add to cart. Select a pricing rule for each item, then press <Kbd>Enter</Kbd> to complete the transaction.
        </div>
      </div>

      <div style={{ ...sectionTitleStyle, fontSize: 'var(--font-size-md)', marginTop: 'var(--space-lg)' }}>
        Optional: TMDb Integration
      </div>
      <div style={descStyle}>
        Add a TMDb API key in Settings &gt; Integration to automatically fetch movie posters, descriptions, and ratings when importing titles.
      </div>
    </div>
  );
}

function FeaturesTab() {
  return (
    <div>
      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>POS &mdash; Point of Sale (<Kbd>F1</Kbd>)</div>
        <div style={descStyle}>
          Search or scan titles and products to add to cart. Manage customer selection, apply pricing rules, hold/recall transactions, and complete sales. Age restriction warnings appear for R/NC-17 content.
        </div>
      </div>

      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>Customers (<Kbd>F2</Kbd>)</div>
        <div style={descStyle}>
          Search, create, and manage customer accounts. View rental history, adjust account balances, add family members, and print membership cards.
        </div>
      </div>

      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>Returns (<Kbd>F3</Kbd>)</div>
        <div style={descStyle}>
          Scan or search copies to process returns. Late fee handling options: pay now, add to balance, or forgive. Reservation alerts notify you when a returned title has someone waiting.
        </div>
      </div>

      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>Inventory (<Kbd>F4</Kbd>)</div>
        <div style={descStyle}>
          Browse your full catalog with grid or list view. Filter by format, rating, and availability. Manage individual copies, view check-out status, and track condition.
        </div>
      </div>

      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>Import (<Kbd>F5</Kbd>)</div>
        <div style={descStyle}>
          Upload a CSV of titles, map columns to fields, preview matches from TMDb, and bulk-create titles with copies in one step.
        </div>
      </div>

      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>Dashboard (<Kbd>F6</Kbd>)</div>
        <div style={descStyle}>
          At-a-glance view of today's activity, overdue items, recent transactions, active reservations, and catalog/customer counts. Refreshes automatically.
        </div>
      </div>

      <div style={featureBlockStyle}>
        <div style={featureTitleStyle}>Settings (<Kbd>F10</Kbd>)</div>
        <div style={descStyle}>
          Configure store info, tax rate, rental policies, pricing rules, promotions, theme, backups, TMDb integration, and developer tools.
        </div>
      </div>

      <div style={sectionTitleStyle}>Keyboard Shortcuts</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Key</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={tdStyle}><Kbd>F1</Kbd></td><td style={tdStyle}>POS / Point of Sale</td></tr>
          <tr><td style={tdStyle}><Kbd>F2</Kbd></td><td style={tdStyle}>Customers</td></tr>
          <tr><td style={tdStyle}><Kbd>F3</Kbd></td><td style={tdStyle}>Returns</td></tr>
          <tr><td style={tdStyle}><Kbd>F4</Kbd></td><td style={tdStyle}>Inventory</td></tr>
          <tr><td style={tdStyle}><Kbd>F5</Kbd></td><td style={tdStyle}>Import (also: Hold transaction in POS)</td></tr>
          <tr><td style={tdStyle}><Kbd>F6</Kbd></td><td style={tdStyle}>Dashboard</td></tr>
          <tr><td style={tdStyle}><Kbd>F10</Kbd></td><td style={tdStyle}>Settings</td></tr>
          <tr><td style={tdStyle}><Kbd>Enter</Kbd></td><td style={tdStyle}>Complete transaction / Confirm action</td></tr>
          <tr><td style={tdStyle}><Kbd>Escape</Kbd></td><td style={tdStyle}>Cancel / Close modal / Clear selection</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function FAQTab() {
  return (
    <div>
      <div style={faqQuestionStyle}>What do [R], [P], [F] mean in the POS cart?</div>
      <div style={faqAnswerStyle}>
        These indicate line item types: <strong>[R]</strong> = Rental, <strong>[P]</strong> = Product (sale item), <strong>[F]</strong> = Fee (late fee or other charge).
      </div>

      <div style={faqQuestionStyle}>Why can't I complete a rental?</div>
      <div style={faqAnswerStyle}>
        Make sure you have: (1) a customer selected, (2) at least one item in the cart, and (3) a pricing rule assigned to each rental item. Also check for age restriction warnings on R/NC-17 titles.
      </div>

      <div style={faqQuestionStyle}>How do late fees work?</div>
      <div style={faqAnswerStyle}>
        Late fees are calculated based on the due date, the grace period (configurable in Settings), and the "return by hour" setting. If a rental is returned after the grace period, a fee is generated. At return time, you can pay the fee immediately, add it to the customer's balance, or forgive it.
      </div>

      <div style={faqQuestionStyle}>How do backups work?</div>
      <div style={faqAnswerStyle}>
        reRun creates automatic daily backups (keeping the last 30). You can also create manual backups from Settings &gt; Backup &amp; Restore. Restoring a backup replaces the current database and triggers a restart.
      </div>

      <div style={faqQuestionStyle}>What's the "Ring Up in Lightspeed" total?</div>
      <div style={faqAnswerStyle}>
        That's the total amount (including tax) to charge in your external payment system. reRun tracks the transaction but payment is handled outside the app.
      </div>

      <div style={faqQuestionStyle}>How do I change the theme?</div>
      <div style={faqAnswerStyle}>
        Go to Settings (<Kbd>F10</Kbd>) &gt; Appearance &gt; Theme. There are 6 retro CRT themes to choose from. The theme previews instantly when you select it.
      </div>

      <div style={faqQuestionStyle}>How do family members work?</div>
      <div style={faqAnswerStyle}>
        Family members are added to a customer account in the Customers section. They can rent under the parent's account but are age-checked independently. This is useful for household accounts where kids need separate age verification.
      </div>

      <div style={faqQuestionStyle}>What happens when I hold a transaction?</div>
      <div style={faqAnswerStyle}>
        Holding a transaction (<Kbd>F5</Kbd> in POS) saves the current cart and customer for later. You can recall held transactions from the POS sidebar to resume where you left off.
      </div>
    </div>
  );
}

export function HelpModal({ isOpen, onClose, initialTab = 'start' }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>(initialTab);

  // Reset tab when opened with a different initialTab
  const handleTabClick = (tab: HelpTab) => setActiveTab(tab);

  if (!isOpen) return null;

  const tabs: { key: HelpTab; label: string }[] = [
    { key: 'start', label: 'Quick Start' },
    { key: 'features', label: 'Features' },
    { key: 'faq', label: 'FAQ' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help & Guide" maxWidth="900px">
      <div style={tabBarStyle}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            style={{
              ...tabStyle,
              ...(activeTab === tab.key ? tabActiveStyle : {}),
            }}
            onClick={() => handleTabClick(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'start' && <QuickStartTab />}
      {activeTab === 'features' && <FeaturesTab />}
      {activeTab === 'faq' && <FAQTab />}
    </Modal>
  );
}

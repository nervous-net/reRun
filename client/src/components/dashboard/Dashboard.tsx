// ABOUTME: Home dashboard screen with activity summary, alerts, overdue items, and quick stats
// ABOUTME: Dense, information-rich CRT terminal layout using CSS grid with box-drawing characters

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';

// --- Grid layout ---

const pageStyle: CSSProperties = {
  padding: 'var(--space-md)',
  height: '100%',
  overflowY: 'auto',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-md)',
};

const fullWidthStyle: CSSProperties = {
  gridColumn: '1 / -1',
};

// --- Panel box styles ---

const panelStyle: CSSProperties = {
  backgroundColor: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  overflow: 'hidden',
};

const panelHeaderStyle: CSSProperties = {
  color: 'var(--crt-green)',
  textShadow: 'var(--glow-green)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '2px',
  padding: 'var(--space-xs) var(--space-sm)',
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const panelBodyStyle: CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
};

// --- Stat row ---

const statRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  borderBottom: '1px solid var(--accent-05)',
};

const statLabelStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-md)',
};

const statValueStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-md)',
  fontWeight: 'bold',
  textShadow: 'var(--glow-green)',
};

// --- Alert link ---

const alertLinkStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px var(--space-sm)',
  marginBottom: 'var(--space-xs)',
  borderRadius: 'var(--border-radius)',
  backgroundColor: 'var(--bg-secondary)',
  textDecoration: 'none',
  transition: 'background-color 0.15s ease',
  cursor: 'pointer',
};

// --- Table styles ---

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-md)',
};

const thStyle: CSSProperties = {
  color: 'var(--crt-green)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontSize: 'var(--font-size-sm)',
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--crt-green-dim)',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  color: 'var(--text-primary)',
  padding: '4px 8px',
  borderBottom: '1px solid var(--border-color)',
};

const daysLateStyle: CSSProperties = {
  color: 'var(--crt-red)',
  fontWeight: 'bold',
  textShadow: '0 0 8px var(--error-40)',
};

const viewAllLinkStyle: CSSProperties = {
  display: 'block',
  textAlign: 'right',
  padding: 'var(--space-xs) var(--space-sm)',
  color: 'var(--crt-cyan)',
  textDecoration: 'none',
  fontSize: 'var(--font-size-sm)',
  letterSpacing: '1px',
};

// --- Reservation row ---

const reservationRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  borderBottom: '1px solid var(--accent-05)',
  fontSize: 'var(--font-size-md)',
};

const reservationTextStyle: CSSProperties = {
  color: 'var(--text-primary)',
};

const arrowStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  margin: '0 6px',
};

// --- Loading / error ---

const loadingStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-sm)',
  padding: 'var(--space-sm)',
  textAlign: 'center',
};

const errorStyle: CSSProperties = {
  color: 'var(--crt-red)',
  fontSize: 'var(--font-size-sm)',
  padding: 'var(--space-sm)',
};

// --- Helpers ---

function formatPanelHeader(title: string): string {
  const inner = ` ${title} `;
  const padLen = Math.max(0, 40 - inner.length - 2);
  const left = Math.floor(padLen / 2);
  const right = padLen - left;
  return `╔${'═'.repeat(left)}${inner}${'═'.repeat(right)}╗`;
}

function daysLate(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// --- Ref code style ---

const refCodeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--crt-cyan)',
  letterSpacing: '1px',
  fontSize: 'var(--font-size-sm)',
};

const voidedStyle: CSSProperties = {
  color: 'var(--crt-red)',
  textDecoration: 'line-through',
};

// --- Component ---

export function Dashboard() {
  const [overdueRentals, setOverdueRentals] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [titleCount, setTitleCount] = useState<number | null>(null);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [todayStats, setTodayStats] = useState<{
    rentalsToday: number;
    returnsToday: number;
    revenueCents: number;
    lateFeesCollectedCents: number;
  } | null>(null);

  const loadDashboard = useCallback(async () => {
    const errs: string[] = [];

    const [overdueResult, lowStockResult, reservationsResult, titlesResult, customersResult, statsResult, recentResult] =
      await Promise.allSettled([
        api.rentals.overdue(),
        api.products.lowStock(),
        api.reservations.list(),
        api.titles.list({ limit: '1' }),
        api.customers.list({ limit: '1' }),
        api.dashboard.stats(),
        api.dashboard.recent(10),
      ]);

    if (overdueResult.status === 'fulfilled') {
      const data = overdueResult.value;
      setOverdueRentals(Array.isArray(data) ? data : data?.data ?? []);
    } else {
      errs.push('overdue rentals');
    }

    if (lowStockResult.status === 'fulfilled') {
      const data = lowStockResult.value;
      setLowStockProducts(Array.isArray(data) ? data : data?.data ?? []);
    } else {
      errs.push('low stock');
    }

    if (reservationsResult.status === 'fulfilled') {
      const data = reservationsResult.value;
      setReservations(Array.isArray(data) ? data : data?.data ?? []);
    } else {
      errs.push('reservations');
    }

    if (titlesResult.status === 'fulfilled') {
      const data = titlesResult.value;
      setTitleCount(data?.total ?? data?.count ?? (Array.isArray(data) ? data.length : null));
    } else {
      errs.push('titles');
    }

    if (customersResult.status === 'fulfilled') {
      const data = customersResult.value;
      setCustomerCount(data?.total ?? data?.count ?? (Array.isArray(data) ? data.length : null));
    } else {
      errs.push('customers');
    }

    if (statsResult.status === 'fulfilled') {
      setTodayStats(statsResult.value);
    } else {
      errs.push('dashboard stats');
    }

    if (recentResult.status === 'fulfilled') {
      const data = recentResult.value;
      setRecentTransactions(Array.isArray(data) ? data : data?.data ?? []);
    } else {
      errs.push('recent transactions');
    }

    setErrors(errs);
    setLoading(false);
  }, []);

  // Load on mount + refresh every 30s + refetch on window focus
  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30_000);
    const handleFocus = () => loadDashboard();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadDashboard]);

  const overdueCount = overdueRentals.length;
  const lowStockCount = lowStockProducts.length;
  const limitedOverdue = overdueRentals.slice(0, 10);
  const limitedReservations = reservations.slice(0, 5);

  return (
    <div style={pageStyle}>
      {errors.length > 0 && (
        <div style={{ ...errorStyle, marginBottom: 'var(--space-sm)' }}>
          Failed to load: {errors.join(', ')}
        </div>
      )}

      <div style={gridStyle}>
        {/* Row 1, Left: Today's Activity */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>{formatPanelHeader("TODAY'S ACTIVITY")}</div>
          <div style={panelBodyStyle}>
            <div style={statRowStyle}>
              <span style={statLabelStyle}>Rentals today</span>
              <span style={statValueStyle}>{todayStats ? todayStats.rentalsToday : '—'}</span>
            </div>
            <div style={statRowStyle}>
              <span style={statLabelStyle}>Returns today</span>
              <span style={statValueStyle}>{todayStats ? todayStats.returnsToday : '—'}</span>
            </div>
            <div style={statRowStyle}>
              <span style={statLabelStyle}>Revenue</span>
              <span style={statValueStyle}>
                {todayStats ? formatCurrency(todayStats.revenueCents) : '—'}
              </span>
            </div>
            <div style={statRowStyle}>
              <span style={statLabelStyle}>Late fees collected</span>
              <span style={statValueStyle}>
                {todayStats ? formatCurrency(todayStats.lateFeesCollectedCents) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Row 1, Right: Alerts */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>{formatPanelHeader('ALERTS')}</div>
          <div style={panelBodyStyle}>
            {loading ? (
              <div style={loadingStyle}>Scanning...</div>
            ) : (
              <>
                <Link
                  to="/returns"
                  style={alertLinkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--error-08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                >
                  <span style={{ color: overdueCount > 0 ? 'var(--crt-red)' : 'var(--text-secondary)' }}>
                    Overdue items
                  </span>
                  <Badge variant={overdueCount > 0 ? 'danger' : 'success'}>
                    {overdueCount}
                  </Badge>
                </Link>
                <Link
                  to="/inventory"
                  style={alertLinkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--warning-08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                >
                  <span style={{ color: lowStockCount > 0 ? 'var(--crt-amber)' : 'var(--text-secondary)' }}>
                    Low stock items
                  </span>
                  <Badge variant={lowStockCount > 0 ? 'warning' : 'success'}>
                    {lowStockCount}
                  </Badge>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Row 2, Full Width: Overdue Items */}
        <div style={{ ...panelStyle, ...fullWidthStyle }}>
          <div style={panelHeaderStyle}>{formatPanelHeader('OVERDUE ITEMS')}</div>
          <div style={{ padding: 0 }}>
            {loading ? (
              <div style={loadingStyle}>Scanning overdue rentals...</div>
            ) : overdueCount === 0 ? (
              <div style={{
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 'var(--space-md)',
                fontStyle: 'italic',
              }}>
                No overdue items. All clear.
              </div>
            ) : (
              <>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Customer</th>
                      <th style={thStyle}>Title</th>
                      <th style={{ ...thStyle, width: '90px' }}>Due Date</th>
                      <th style={{ ...thStyle, width: '80px', textAlign: 'right' }}>Days Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitedOverdue.map((rental: any, i: number) => {
                      let customerName = rental.customerFirstName
                        ? `${rental.customerFirstName} ${rental.customerLastName}`
                        : rental.customerName ?? '—';
                      if (rental.familyMemberFirstName) {
                        const fmName = `${rental.familyMemberFirstName} ${rental.familyMemberLastName ?? ''}`.trim();
                        const fmLabel = rental.familyMemberRelationship
                          ? `${fmName} (${rental.familyMemberRelationship})`
                          : fmName;
                        customerName = `${customerName} — ${fmLabel}`;
                      }
                      const titleName = rental.titleName ?? '—';
                      const dueDate = rental.dueAt ?? '';
                      const late = dueDate ? daysLate(dueDate) : 0;

                      return (
                        <tr
                          key={rental.id ?? i}
                          style={{
                            backgroundColor: i % 2 === 1 ? 'var(--accent-02)' : 'transparent',
                          }}
                        >
                          <td style={tdStyle}>{customerName}</td>
                          <td style={tdStyle}>{titleName}</td>
                          <td style={tdStyle}>{dueDate ? formatDate(dueDate) : '—'}</td>
                          <td style={{ ...tdStyle, ...daysLateStyle, textAlign: 'right' }}>
                            {late > 0 ? `+${late}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {overdueCount > 10 && (
                  <Link to="/returns" style={viewAllLinkStyle}>
                    View all {overdueCount} overdue items &gt;&gt;
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Row 2.5, Full Width: Recent Transactions */}
        <div style={{ ...panelStyle, ...fullWidthStyle }}>
          <div style={panelHeaderStyle}>{formatPanelHeader('RECENT TRANSACTIONS')}</div>
          <div style={{ padding: 0 }}>
            {loading ? (
              <div style={loadingStyle}>Loading transactions...</div>
            ) : recentTransactions.length === 0 ? (
              <div style={{
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 'var(--space-md)',
                fontStyle: 'italic',
              }}>
                No transactions yet
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Ref Code</th>
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Type</th>
                    <th style={{ ...thStyle, width: '90px', textAlign: 'right' }}>Total</th>
                    <th style={{ ...thStyle, width: '90px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((txn: any, i: number) => (
                    <tr
                      key={txn.id ?? i}
                      style={{
                        backgroundColor: i % 2 === 1 ? 'var(--accent-02)' : 'transparent',
                      }}
                    >
                      <td style={{ ...tdStyle, ...(txn.voided ? voidedStyle : refCodeStyle) }}>
                        {txn.referenceCode ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, ...(txn.voided ? voidedStyle : {}) }}>
                        {txn.customerName ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, ...(txn.voided ? voidedStyle : {}) }}>
                        {txn.type}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', ...(txn.voided ? voidedStyle : {}) }}>
                        {formatCurrency(txn.total)}
                      </td>
                      <td style={{ ...tdStyle, ...(txn.voided ? voidedStyle : {}) }}>
                        {txn.createdAt ? formatTime(txn.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Row 3, Left: Active Reservations */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>{formatPanelHeader('ACTIVE RESERVATIONS')}</div>
          <div style={panelBodyStyle}>
            {loading ? (
              <div style={loadingStyle}>Loading...</div>
            ) : limitedReservations.length === 0 ? (
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
                fontStyle: 'italic',
              }}>
                No active reservations
              </div>
            ) : (
              limitedReservations.map((res: any, i: number) => {
                const customerName = res.customerName ?? '—';
                const titleName = res.titleName ?? '—';
                const status = res.status ?? 'waiting';

                return (
                  <Link
                    key={res.id ?? i}
                    to={`/pos?customerId=${res.customerId ?? ''}&reservationId=${res.id ?? ''}`}
                    style={{ ...reservationRowStyle, textDecoration: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-10)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div>
                      <span style={reservationTextStyle}>{customerName}</span>
                      <span style={arrowStyle}>&rarr;</span>
                      <span style={reservationTextStyle}>{titleName}</span>
                    </div>
                    <Badge variant={status === 'available' || status === 'ready' ? 'success' : 'info'}>
                      {status}
                    </Badge>
                  </Link>
                );
              })
            )}
            {reservations.length > 5 && (
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
                paddingTop: 'var(--space-xs)',
                textAlign: 'right',
              }}>
                +{reservations.length - 5} more
              </div>
            )}
          </div>
        </div>

        {/* Row 3, Right: Quick Stats */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>{formatPanelHeader('QUICK STATS')}</div>
          <div style={panelBodyStyle}>
            {loading ? (
              <div style={loadingStyle}>Loading...</div>
            ) : (
              <>
                <div style={statRowStyle}>
                  <span style={statLabelStyle}>Titles in catalog</span>
                  <span style={statValueStyle}>{titleCount ?? '—'}</span>
                </div>
                <div style={statRowStyle}>
                  <span style={statLabelStyle}>Active reservations</span>
                  <span style={statValueStyle}>{reservations.length}</span>
                </div>
                <div style={statRowStyle}>
                  <span style={statLabelStyle}>Total customers</span>
                  <span style={statValueStyle}>{customerCount ?? '—'}</span>
                </div>
                <div style={statRowStyle}>
                  <span style={statLabelStyle}>Overdue rentals</span>
                  <span style={{
                    ...statValueStyle,
                    color: overdueCount > 0 ? 'var(--crt-red)' : 'var(--crt-green)',
                    textShadow: overdueCount > 0
                      ? '0 0 8px var(--error-40)'
                      : 'var(--glow-green)',
                  }}>
                    {overdueCount}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

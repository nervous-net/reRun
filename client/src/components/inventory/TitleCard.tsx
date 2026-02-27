// ABOUTME: Grid view card for a single title in the inventory browser
// ABOUTME: Shows cover art, title, year, format badges, and availability status

import { type CSSProperties, useState } from 'react';
import { Badge } from '../common/Badge';

export interface TitleSummary {
  id: string;
  name: string;
  year: number;
  genre: string;
  rating: string;
  coverUrl?: string;
  availableCopies: number;
  totalCopies: number;
  formats: string[];
}

interface TitleCardProps {
  title: TitleSummary;
  onClick: (id: string) => void;
}

const cardStyle: CSSProperties = {
  width: '200px',
  border: '1px solid var(--crt-green-dim)',
  borderRadius: 'var(--border-radius)',
  backgroundColor: 'var(--bg-panel)',
  cursor: 'pointer',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const cardHoverStyle: CSSProperties = {
  boxShadow: 'var(--glow-green)',
  borderColor: 'var(--crt-green)',
};

const coverStyle: CSSProperties = {
  width: '100%',
  height: '260px',
  objectFit: 'cover',
  display: 'block',
  borderBottom: '1px solid var(--border-color)',
};

const placeholderStyle: CSSProperties = {
  width: '100%',
  height: '260px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--bg-input)',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  textAlign: 'center',
  lineHeight: 1.8,
};

const bodyStyle: CSSProperties = {
  padding: 'var(--space-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  flex: 1,
};

const titleNameStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-md)',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.3,
};

const yearStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
};

const badgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  marginTop: 'auto',
};

function getAvailabilityVariant(available: number, total: number): 'success' | 'warning' | 'danger' {
  if (total === 0) return 'danger';
  if (available === 0) return 'danger';
  if (available < total) return 'warning';
  return 'success';
}

function getAvailabilityLabel(available: number, total: number): string {
  if (total === 0) return 'No copies';
  return `${available}/${total} avail`;
}

export function TitleCard({ title, onClick }: TitleCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ ...cardStyle, ...(hovered ? cardHoverStyle : {}) }}
      onClick={() => onClick(title.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {title.coverUrl ? (
        <img src={title.coverUrl} alt={title.name} style={coverStyle} />
      ) : (
        <div style={placeholderStyle}>
          [ NO SIGNAL ]<br />
          NO COVER
        </div>
      )}

      <div style={bodyStyle}>
        <div style={titleNameStyle} title={title.name}>
          {title.name}
        </div>
        <div style={yearStyle}>{title.year}</div>
        <div style={badgeRowStyle}>
          {title.formats.map((fmt) => (
            <Badge key={fmt} variant="info">{fmt}</Badge>
          ))}
          <Badge variant={getAvailabilityVariant(title.availableCopies, title.totalCopies)}>
            {getAvailabilityLabel(title.availableCopies, title.totalCopies)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

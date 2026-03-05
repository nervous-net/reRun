// ABOUTME: Modal picker for selecting which family member is renting at POS
// ABOUTME: Shows account holder and active family members with CRT-styled selection buttons

import { type CSSProperties } from 'react';

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  birthday: string;
}

interface FamilyMemberPickerProps {
  customerName: string;
  familyMembers: FamilyMember[];
  onSelect: (member: FamilyMember | null) => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-sm)',
};

const headingStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-lg)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  textShadow: '0 0 10px var(--accent-50)',
  marginBottom: 'var(--space-sm)',
  textAlign: 'center',
};

const optionStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-md)',
  padding: 'var(--space-sm) var(--space-md)',
  background: 'transparent',
  color: 'var(--crt-green)',
  border: '1px solid var(--crt-green)',
  borderRadius: 'var(--border-radius)',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  textAlign: 'left' as const,
};

export function FamilyMemberPicker({ customerName, familyMembers, onSelect }: FamilyMemberPickerProps) {
  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Who is renting?</h2>
      <button
        style={optionStyle}
        onClick={() => onSelect(null)}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--crt-green)';
          e.currentTarget.style.boxShadow = 'var(--glow-green)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        {customerName} (Account Holder)
      </button>
      {familyMembers.map((member) => (
        <button
          key={member.id}
          style={optionStyle}
          onClick={() => onSelect(member)}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--crt-green)';
            e.currentTarget.style.boxShadow = 'var(--glow-green)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          {member.firstName} {member.lastName} ({member.relationship})
        </button>
      ))}
    </div>
  );
}

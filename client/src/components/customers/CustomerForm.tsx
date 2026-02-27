// ABOUTME: Modal form for creating and editing customer records
// ABOUTME: Pre-fills fields when editing, validates required fields, calls create or update API

import { type CSSProperties, useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { api } from '../../api/client';

interface CustomerFormProps {
  onClose: () => void;
  onSaved: () => void;
  customerId?: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  birthday: string;
  notes: string;
}

const emptyForm: FormData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: '',
  birthday: '',
  notes: '',
};

export function CustomerForm({ onClose, onSaved, customerId }: CustomerFormProps) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!customerId);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!customerId;

  useEffect(() => {
    if (!customerId) return;
    setLoadingData(true);
    api.customers
      .get(customerId)
      .then((data: any) => {
        setForm({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          address: data.address ?? '',
          birthday: data.birthday ?? '',
          notes: data.notes ?? '',
        });
      })
      .catch(() => {
        setError('Failed to load customer data');
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [customerId]);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Record<string, string | undefined> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      birthday: form.birthday.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (isEditing) {
        await api.customers.update(customerId, payload);
      } else {
        await api.customers.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && !loading;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Edit Customer' : 'New Customer'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      {loadingData ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <div style={styles.fields}>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.row}>
            <Input
              label="First Name *"
              value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              required
            />
            <Input
              label="Last Name *"
              value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              required
            />
          </div>
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            type="tel"
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            type="email"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
          />
          <Input
            label="Birthday (YYYY-MM-DD)"
            value={form.birthday}
            onChange={(e) => updateField('birthday', e.target.value)}
            placeholder="YYYY-MM-DD"
          />
          <div style={styles.textareaWrapper}>
            <label style={styles.label}>Notes</label>
            <textarea
              style={styles.textarea}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
  },
  row: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  loading: {
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: 'var(--space-lg)',
    fontStyle: 'italic',
  },
  error: {
    color: 'var(--crt-red)',
    fontSize: 'var(--font-size-sm)',
    padding: '4px 8px',
    backgroundColor: 'var(--error-10)',
    borderRadius: 'var(--border-radius)',
  },
  textareaWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    width: '100%',
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  textarea: {
    fontFamily: 'inherit',
    fontSize: 'var(--font-size-md)',
    padding: '6px 8px',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
};

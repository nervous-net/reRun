// ABOUTME: Accessibility-focused tests for the Modal component
// ABOUTME: Verifies ARIA attributes, keyboard dismiss, overlay click, and focus management

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from '@client/components/common/Modal';

describe('Modal', () => {
  it('renders children when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>Hello from modal</p>
      </Modal>
    );
    expect(screen.getByText('Hello from modal')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Hidden content</p>
      </Modal>
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Dialog">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby pointing to title element', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Title">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe('My Title');
  });

  it('does not have aria-labelledby when no title provided', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>No title</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Esc Test">
        <p>Press escape</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on overlay click', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Overlay Test">
        <p>Click outside</p>
      </Modal>
    );
    // The overlay is the parent div that wraps the panel
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside panel', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Panel Click">
        <p>Click me</p>
      </Modal>
    );
    fireEvent.click(screen.getByText('Click me'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into modal when opened', async () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Focus Test">
        <button>First button</button>
      </Modal>
    );
    // Modal uses setTimeout(0) for focus, so we need to wait
    await waitFor(() => {
      // The close button (X) or the first focusable element should have focus
      const activeEl = document.activeElement;
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(activeEl)).toBe(true);
    });
  });

  it('renders footer when provided', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Footer Test" footer={<button>Save</button>}>
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Close Btn">
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn).toHaveAttribute('aria-label', 'Close');
  });
});

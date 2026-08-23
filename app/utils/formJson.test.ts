import { describe, expect, it, vi } from 'vitest';
import { formJson } from './formJson';

function buildForm(entries: Record<string, string | Blob>): HTMLFormElement {
  const form = document.createElement('form');
  for (const [name, value] of Object.entries(entries)) {
    const input = document.createElement('input');
    input.name = name;
    if (typeof value === 'string') {
      input.value = value;
    } else {
      // File inputs cannot have their value set programmatically, so we attach
      // a hidden file input via Object.defineProperty for the test only.
      input.type = 'file';
      Object.defineProperty(input, 'files', {
        value: [value],
        writable: false,
      });
    }
    form.appendChild(input);
  }
  return form;
}

describe('formJson', () => {
  it('serialises plain text fields into a typed object', async () => {
    const form = buildForm({ name: 'Acme', email: 'hello@acme.test' });
    const data = await formJson<{ name: string; email: string }>(form);

    expect(data).toEqual({ name: 'Acme', email: 'hello@acme.test' });
  });

  it('returns empty strings for fields the user left blank', async () => {
    const form = buildForm({ filled: 'value', empty: '' });
    const data = await formJson<{ filled: string; empty: string }>(form);

    expect(data).toEqual({ filled: 'value', empty: '' });
  });

  it('converts a Blob field to a base64 data URL', async () => {
    const content = 'hello';
    const blob = new Blob([content], { type: 'text/plain' });
    const form = buildForm({ note: 'note text', attachment: blob });

    // jsdom's FileReader does not actually read Blob contents, so we provide a
    // minimal stub that returns a deterministic data URL once onloadend fires.
    const originalFileReader = globalThis.FileReader;
    vi.stubGlobal(
      'FileReader',
      vi.fn(() => ({
        readAsDataURL: vi.fn(function (this: { onloadend?: () => void }) {
          setTimeout(() => this.onloadend?.(), 0);
        }),
        result: 'data:text/plain;base64,aGVsbG8=',
      }))
    );

    try {
      const data = await formJson<{ note: string; attachment: string }>(form);
      expect(data.note).toBe('note text');
      expect(data.attachment).toBe('data:text/plain;base64,aGVsbG8=');
    } finally {
      vi.stubGlobal('FileReader', originalFileReader);
    }
  });

  it('keeps string values unchanged when no processor matches', async () => {
    // The implementation has no processors beyond 'base64', so arbitrary strings
    // should pass through untouched.
    const form = buildForm({ unknown: 'plain value' });
    const data = await formJson<{ unknown: string }>(form);

    expect(data.unknown).toBe('plain value');
  });
});

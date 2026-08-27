import { describe, expect, it } from 'vitest';
import { Address } from './address';

describe('Address', () => {
  it('stores all address fields', () => {
    // An invoice needs a complete from/to address for legal and postal purposes.
    const address = new Address(
      'Acme Ltd',
      '1 Example Street',
      'London',
      'Greater London',
      'SW1A 1AA'
    );
    expect(address.name).toBe('Acme Ltd');
    expect(address.streetAddress).toBe('1 Example Street');
    expect(address.city).toBe('London');
    expect(address.county).toBe('Greater London');
    expect(address.postCode).toBe('SW1A 1AA');
  });

  it('supports empty fields', () => {
    // The UI allows partial addresses while the user is still typing.
    const address = new Address('', '', '', '', '');
    expect(address.name).toBe('');
    expect(address.postCode).toBe('');
  });
});

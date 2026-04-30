import { describe, expect, it } from 'vitest';
import { hashSet, hashString, shortHash } from '../hash.js';
import { redactObjectPII, redactPII } from '../pii-redaction.js';

describe('utility helpers', () => {
  it('hashes strings and sets deterministically', () => {
    expect(hashString('abc')).toHaveLength(64);
    expect(shortHash('abc')).toHaveLength(8);
    expect(hashSet(['beta', 'alpha', 'alpha'])).toHaveLength(2);
  });

  it('redacts pii from text and objects', () => {
    const text = 'Email me at test@example.com or call 415-555-1212';
    expect(redactPII(text)).toContain('[EMAIL_REDACTED]');
    expect(redactPII(text)).toContain('[PHONE_REDACTED]');

    const redacted = redactObjectPII({
      contact: 'test@example.com',
      nested: { ip: '127.0.0.1' },
    });
    expect(JSON.stringify(redacted)).toContain('[EMAIL_REDACTED]');
    expect(JSON.stringify(redacted)).toContain('[IP_REDACTED]');
  });
});

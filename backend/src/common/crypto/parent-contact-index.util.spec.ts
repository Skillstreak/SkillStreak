import {
  isEmailContact,
  normaliseParentContact,
  parentContactIndex,
} from './parent-contact-index.util';

const KEY_A = 'Y2ktb25seS10ZXN0LWtleS0zMi1ieXRlcy1sb25nISE=';
const KEY_B = Buffer.alloc(32, 7).toString('base64');

describe('normaliseParentContact', () => {
  it.each([
    ['  Anna.Svensson@Example.SE ', 'anna.svensson@example.se'],
    ['+46 70-123 45 67', '+46701234567'],
    ['070 123 45 67', '0701234567'],
    ['(070) 123.45.67', '0701234567'],
    ['0046 70 123 45 67', '+46701234567'],
    ['Anna+1@Example.se', 'anna@example.se'],
    ['a.n.n.a+x@googlemail.com', 'anna@gmail.com'],
    ['A.Nna@Gmail.com', 'anna@gmail.com'],
    ['a.nna@outlook.com', 'a.nna@outlook.com'],
  ])('%p -> %p', (raw, normalised) => {
    expect(normaliseParentContact(raw)).toBe(normalised);
  });
});

describe('parentContactIndex', () => {
  it('is the same for spellings of the same address', () => {
    expect(parentContactIndex('Anna@Example.se', KEY_A)).toBe(
      parentContactIndex(' anna@example.SE', KEY_A),
    );
  });

  it('differs between addresses', () => {
    expect(parentContactIndex('anna@example.se', KEY_A)).not.toBe(
      parentContactIndex('bo@example.se', KEY_A),
    );
  });

  it('depends on the key (a dump without the key cannot test guesses)', () => {
    expect(parentContactIndex('anna@example.se', KEY_A)).not.toBe(
      parentContactIndex('anna@example.se', KEY_B),
    );
  });

  it('is 64 hex chars and does not contain the address', () => {
    const index = parentContactIndex('anna@example.se', KEY_A);
    expect(index).toMatch(/^[0-9a-f]{64}$/);
    expect(index).not.toContain('anna');
  });
});

describe('isEmailContact', () => {
  it('tells an email from a phone number', () => {
    expect(isEmailContact('a@b.se')).toBe(true);
    expect(isEmailContact('+46701234567')).toBe(false);
  });
});

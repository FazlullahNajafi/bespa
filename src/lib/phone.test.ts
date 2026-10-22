import { fromE164, isValidNational, toE164, toNational } from './phone';

describe('fromE164', () => {
  it('shows an Indian number without the country code', () => {
    expect(fromE164('+919419000000')).toBe('9419000000');
  });

  it('is empty for no number', () => {
    expect(fromE164(null)).toBe('');
    expect(fromE164('')).toBe('');
  });

  it('shows a foreign number whole rather than dropping a prefix the user cannot see', () => {
    expect(fromE164('+442071838750')).toBe('+442071838750');
  });

  it('does not mistake a +91 prefix on something malformed for a national number', () => {
    expect(fromE164('+9112')).toBe('+9112');
  });
});

describe('toNational', () => {
  it('keeps ten plain digits', () => {
    expect(toNational('9419000000')).toBe('9419000000');
  });

  it.each([
    ['94190 00000', 'a space, as a phone is written'],
    ['94190-00000', 'a dash'],
    ['09419000000', 'the leading zero people dial'],
    ['+91 94190 00000', 'the country code typed anyway'],
    ['919419000000', 'the country code without the plus'],
  ])('accepts %s (%s)', (typed) => {
    expect(toNational(typed)).toBe('9419000000');
  });
});

describe('isValidNational', () => {
  it('accepts a mobile number', () => {
    expect(isValidNational('9419000000')).toBe(true);
  });

  it('accepts a landline with its STD code, which a shopkeeper may well give', () => {
    // The Deputy Commissioner's own number, from spec 05: 01985-232216.
    expect(isValidNational('1985232216')).toBe(true);
  });

  it('does not strip 91 from a mobile that merely starts with it', () => {
    expect(toNational('9123456789')).toBe('9123456789');
  });

  it.each([
    ['941900000', 'nine digits'],
    ['94190000001', 'eleven digits'],
    ['0419000000', 'starts with 0'],
    ['', 'nothing'],
  ] as [string, string][])('rejects %s (%s)', (typed) => {
    expect(isValidNational(typed)).toBe(false);
  });
});

describe('toE164', () => {
  it('stores what the database constraint expects', () => {
    expect(toE164('94190 00000')).toBe('+919419000000');
  });

  it('is null for an empty field, which is how a number is cleared', () => {
    expect(toE164('')).toBeNull();
  });

  it('is null rather than a half-built number when the input is wrong', () => {
    expect(toE164('12345')).toBeNull();
  });
});

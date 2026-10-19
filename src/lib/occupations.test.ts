import { OCCUPATIONS, isKnownOccupation, labelFor } from './occupations';

/**
 * Spec 03.6 ends its occupation list with "other + free text", which makes the column
 * hold two different kinds of value: a key from the list, and a sentence the user typed.
 * Reading one back means telling them apart, and getting that backwards shows a villager
 * the string `digital_creator` or hands a translator "Runs the petrol pump at Baroo".
 */

const t = (key: string) => `t:${key}`;

describe('isKnownOccupation', () => {
  it('accepts every key in the spec list', () => {
    for (const key of OCCUPATIONS) expect(isKnownOccupation(key)).toBe(true);
  });

  it('rejects free text, including text that looks like a key', () => {
    expect(isKnownOccupation('Runs the petrol pump at Baroo')).toBe(false);
    expect(isKnownOccupation('sarpanch')).toBe(false);
    // Not a key, despite differing from one only in case — the column stores keys
    // exactly, and a near-miss is somebody's own words.
    expect(isKnownOccupation('Farmer')).toBe(false);
  });
});

describe('labelFor', () => {
  it('translates a key from the list', () => {
    expect(labelFor('farmer', t)).toBe('t:profile.occupations.farmer');
  });

  it('shows free text verbatim rather than looking for a key that cannot exist', () => {
    expect(labelFor('Runs the petrol pump at Baroo', t)).toBe('Runs the petrol pump at Baroo');
  });

  it('returns null for no occupation, so the caller can choose its own empty copy', () => {
    expect(labelFor(null, t)).toBeNull();
    expect(labelFor('', t)).toBeNull();
  });
});

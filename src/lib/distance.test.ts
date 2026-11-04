import { formatDistance, metresBetween } from './distance';

// Real coordinates, so a wrong formula fails against a number that can be checked
// against a map rather than against another run of the same code.
const KARGIL_TOWN = { lat: 34.5539, lon: 76.1349 };
const DRASS = { lat: 34.4269, lon: 75.7497 };

describe('metresBetween', () => {
  it('is zero for the same point', () => {
    expect(metresBetween(KARGIL_TOWN, KARGIL_TOWN)).toBe(0);
  });

  it('matches the real Kargil–Drass distance', () => {
    // ~38 km as the crow flies; the road is 58 km because it follows the Suru valley.
    const km = metresBetween(KARGIL_TOWN, DRASS) / 1000;
    expect(km).toBeGreaterThan(37);
    expect(km).toBeLessThan(39);
  });

  it('is symmetric', () => {
    expect(metresBetween(KARGIL_TOWN, DRASS)).toBeCloseTo(
      metresBetween(DRASS, KARGIL_TOWN),
      6,
    );
  });

  it('gives about 111 m for a thousandth of a degree of latitude', () => {
    // The figure the places pgTAP fixture is built on — two schools either side of the
    // 150 m duplicate line. If this drifts, that suite is testing the wrong thing.
    const north = { lat: KARGIL_TOWN.lat + 0.001, lon: KARGIL_TOWN.lon };
    expect(metresBetween(KARGIL_TOWN, north)).toBeGreaterThan(110);
    expect(metresBetween(KARGIL_TOWN, north)).toBeLessThan(112);
  });
});

describe('formatDistance', () => {
  it('rounds metres to fifty, because a GPS fix is not accurate to the metre', () => {
    expect(formatDistance(372)).toEqual({ value: '350', unit: 'm' });
    expect(formatDistance(120)).toEqual({ value: '100', unit: 'm' });
  });

  it('never says a place is 0 m away', () => {
    // Standing on it. "0 m" reads as missing data; "50 m" reads as "right here".
    expect(formatDistance(4)).toEqual({ value: '50', unit: 'm' });
  });

  it('switches to kilometres with one decimal', () => {
    expect(formatDistance(1_200)).toEqual({ value: '1.2', unit: 'km' });
    expect(formatDistance(9_949)).toEqual({ value: '9.9', unit: 'km' });
  });

  it('drops the decimal past ten kilometres', () => {
    expect(formatDistance(38_400)).toEqual({ value: '38', unit: 'km' });
  });
});

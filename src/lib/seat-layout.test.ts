import { columnsIn, layoutFor, shapeOf, type Slot } from './seat-layout';

/** The seat numbers in a row, in order, ignoring gaps and the driver. */
function seatsIn(row: Slot[]): number[] {
  return row.flatMap((slot) => (slot.kind === 'seat' ? [slot.seatNo] : []));
}

function positionOf(rows: Slot[][], seatNo: number): string | null {
  for (const row of rows) {
    for (const slot of row) {
      if (slot.kind === 'seat' && slot.seatNo === seatNo) return slot.position;
    }
  }
  return null;
}

describe('layoutFor', () => {
  it('puts the driver front-right, because India drives on the left', () => {
    const rows = layoutFor('xylo', 6);
    const cab = rows[0];
    // Last slot in the first row, not the first.
    expect(cab[cab.length - 1]).toEqual({ kind: 'driver' });
    expect(cab[0]).toMatchObject({ kind: 'seat', seatNo: 1 });
  });

  it('seats every number exactly once', () => {
    const rows = layoutFor('innova', 7);
    const all = rows.flatMap(seatsIn).sort((a, b) => a - b);
    expect(all).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('marks the outside seats as window seats', () => {
    // "Is there a window seat?" is the passenger's question in spec 04.2, so this is
    // the assertion that keeps the answer true.
    const rows = layoutFor('xylo', 7);
    expect(positionOf(rows, 1)).toBe('window'); // front passenger
    expect(positionOf(rows, 2)).toBe('window'); // left of the middle row
    expect(positionOf(rows, 3)).toBe('middle');
    expect(positionOf(rows, 4)).toBe('window'); // right of the middle row
  });

  it('gives a Tempo Traveller a gangway with two seats and one across it', () => {
    const rows = layoutFor('tempo_traveller', 12);
    const body = rows[1];
    // two seats, gangway, one seat
    expect(body.map((s) => s.kind)).toEqual(['seat', 'seat', 'gap', 'seat']);
    expect(positionOf(rows, 2)).toBe('window');
    expect(positionOf(rows, 3)).toBe('aisle');
    expect(positionOf(rows, 4)).toBe('window');
  });

  it('gives a bus two and two, and no seat beside the driver', () => {
    const rows = layoutFor('bus_large', 8);
    expect(seatsIn(rows[0])).toEqual([]);
    expect(rows[0][rows[0].length - 1]).toEqual({ kind: 'driver' });
    expect(rows[1].map((s) => s.kind)).toEqual(['seat', 'seat', 'gap', 'seat', 'seat']);
  });

  it('pads a part-full back row instead of narrowing it', () => {
    // Five seats in a three-across car: the last row holds one seat and two gaps, so
    // the vehicle keeps its shape rather than tapering to a point.
    const rows = layoutFor('eeco', 5);
    const last = rows[rows.length - 1];
    expect(seatsIn(last)).toHaveLength(1);
    expect(last).toHaveLength(3);
  });

  it('never drops or invents a seat, whatever the count', () => {
    for (const seats of [1, 2, 3, 4, 5, 6, 7, 11, 12, 17, 20, 40]) {
      for (const type of ['xylo', 'tempo_traveller', 'bus_small'] as const) {
        const rows = layoutFor(type, seats);
        const all = rows.flatMap(seatsIn);
        expect(all).toHaveLength(seats);
        expect(new Set(all).size).toBe(seats);
      }
    }
  });

  it('keeps every row the same width, so the body is a rectangle', () => {
    const rows = layoutFor('tempo_traveller', 11);
    const width = columnsIn(rows);
    // The cab row is narrower by design; every body row matches.
    for (const row of rows.slice(1)) expect(row).toHaveLength(width);
  });
});

describe('shapeOf', () => {
  it('folds eight vehicle types into the three plans that actually differ', () => {
    expect(shapeOf('xylo')).toBe('car');
    expect(shapeOf('innova')).toBe('car');
    expect(shapeOf('omni')).toBe('car');
    expect(shapeOf('eeco')).toBe('car');
    expect(shapeOf('other')).toBe('car');
    expect(shapeOf('tempo_traveller')).toBe('van');
    expect(shapeOf('bus_small')).toBe('bus');
    expect(shapeOf('bus_large')).toBe('bus');
  });
});

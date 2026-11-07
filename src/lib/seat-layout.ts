import type { VehicleType } from '@/api/rides';

/**
 * Where each seat physically sits, so the seat map looks like the inside of the vehicle
 * rather than a row of numbered boxes (spec 04.2: the seat map is the module's
 * centrepiece).
 *
 * **This is presentation, derived deterministically — it is not in the database.** The
 * server owns which seat numbers exist and who holds them; where seat 4 sits is a
 * function of the vehicle type and the seat count, computed identically on every phone.
 * Storing it would mean a column that can disagree with the vehicle it describes, and a
 * migration every time a layout is corrected.
 *
 * **The driver sits front-right.** India drives on the left, so the steering wheel is on
 * the right, and a top-down plan with the driver on the left is a picture of a car from
 * somewhere else. Small, and exactly the sort of detail that decides whether a drawing
 * reads as "my vehicle" or as a diagram.
 *
 * Seat 1 is the front passenger seat — the one people ask for by name — then rows fill
 * left to right from the front. That matches how a driver counts his vehicle out loud.
 */

export type SeatPosition = 'window' | 'middle' | 'aisle';

export type Slot =
  | { kind: 'seat'; seatNo: number; position: SeatPosition }
  | { kind: 'driver' }
  /** The gangway. Rendered as empty space, not as a seat. */
  | { kind: 'gap' };

export type VehicleShape = 'car' | 'van' | 'bus';

/**
 * Three real shapes, not eight.
 *
 * A Xylo and an Innova have the same plan; so do an Omni and an Eeco. What changes the
 * drawing is how many seats are across and whether there is a gangway — which is the
 * difference between a car, a Tempo Traveller and a bus.
 */
export function shapeOf(type: VehicleType): VehicleShape {
  switch (type) {
    case 'tempo_traveller':
      return 'van';
    case 'bus_large':
    case 'bus_small':
      return 'bus';
    default:
      return 'car';
  }
}

/** Seats across the back rows, and whether a gangway splits them. */
const PLAN: Record<VehicleShape, { perRow: number; aisleAfter: number | null }> = {
  // Three across, no gangway — you climb over.
  car: { perRow: 3, aisleAfter: null },
  // Two, gangway, one. The Tempo Traveller plan every operator in Ladakh runs.
  van: { perRow: 3, aisleAfter: 2 },
  // Two, gangway, two.
  bus: { perRow: 4, aisleAfter: 2 },
};

function positionIn(index: number, perRow: number, aisleAfter: number | null): SeatPosition {
  const first = index === 0;
  const last = index === perRow - 1;
  if (first || last) return 'window';
  if (aisleAfter !== null && (index === aisleAfter - 1 || index === aisleAfter)) {
    return 'aisle';
  }
  return 'middle';
}

/**
 * The vehicle as rows of slots.
 *
 * The first row is always the cab: the front passenger seat and the driver, with the
 * space between them left empty so the two do not read as a pair of bookable seats.
 */
export function layoutFor(type: VehicleType, seats: number): Slot[][] {
  const shape = shapeOf(type);
  const { perRow, aisleAfter } = PLAN[shape];

  const rows: Slot[][] = [];
  let next = 1;

  // The cab. Seat 1 rides up front beside the driver; on a bus there is no such seat,
  // because the space beside a bus driver is a door and a fare box.
  if (shape === 'bus') {
    rows.push([{ kind: 'gap' }, { kind: 'gap' }, { kind: 'gap' }, { kind: 'driver' }]);
  } else {
    rows.push([
      { kind: 'seat', seatNo: next++, position: 'window' },
      { kind: 'gap' },
      { kind: 'driver' },
    ]);
  }

  while (next <= seats) {
    const row: Slot[] = [];
    for (let i = 0; i < perRow; i += 1) {
      if (aisleAfter !== null && i === aisleAfter) row.push({ kind: 'gap' });
      if (next > seats) {
        // A half-empty back row is drawn as empty space rather than silently narrowed,
        // so the vehicle keeps its shape and the gap reads as "no seat here".
        row.push({ kind: 'gap' });
      } else {
        row.push({
          kind: 'seat',
          seatNo: next++,
          position: positionIn(i, perRow, aisleAfter),
        });
      }
    }
    rows.push(row);
  }

  return rows;
}

/** How wide the widest row is, so every row can be drawn to the same width. */
export function columnsIn(rows: Slot[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

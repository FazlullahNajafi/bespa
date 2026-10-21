import { relativeDate } from './relative-date';

/**
 * Every instant here is written WITHOUT a trailing `Z`, so JavaScript parses it in the
 * runner's own timezone. That is deliberate: `relativeDate` counts local calendar days,
 * because a villager thinks in local time, and a test written in UTC passes on a machine
 * set to UTC and fails on one set to Asia/Kolkata. The first version of this file did
 * exactly that — CI and this laptop would have disagreed about whether it was correct.
 *
 * The case worth pinning down is the boundary between "today" and "yesterday": it is
 * counted in calendar days rather than elapsed hours, so a notice posted at 11pm is
 * "yesterday" by breakfast — nine hours by the clock, but the answer a reader expects.
 */

const at = (local: string) => new Date(local);

describe('relativeDate', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    // Nine hours apart, either side of midnight.
    expect(relativeDate('2026-10-20T23:00:00', at('2026-10-21T08:00:00'))).toEqual({
      key: 'date.yesterday',
    });
    // Twenty-three hours apart, same calendar day.
    expect(relativeDate('2026-10-21T00:30:00', at('2026-10-21T23:30:00'))).toEqual({
      key: 'date.today',
    });
  });

  it('scales from days to weeks to months to years', () => {
    const now = at('2026-10-21T12:00:00');
    expect(relativeDate('2026-10-18T12:00:00', now)).toEqual({
      key: 'date.daysAgo',
      values: { count: 3 },
    });
    expect(relativeDate('2026-10-07T12:00:00', now)).toEqual({
      key: 'date.weeksAgo',
      values: { count: 2 },
    });
    expect(relativeDate('2026-07-21T12:00:00', now)).toEqual({
      key: 'date.monthsAgo',
      values: { count: 3 },
    });
    expect(relativeDate('2024-10-21T12:00:00', now)).toEqual({
      key: 'date.yearsAgo',
      values: { count: 2 },
    });
  });

  it('does not render a future date as a very large past one', () => {
    // published_at ahead of the device clock. Phones here are often set by hand and
    // drift, and "in 4 days ago" is the kind of nonsense that reads as a broken app.
    expect(relativeDate('2026-10-25T12:00:00', at('2026-10-21T12:00:00'))).toEqual({
      key: 'date.upcoming',
    });
  });

  it('returns a key rather than throwing on an unparseable date', () => {
    expect(relativeDate('not a date')).toEqual({ key: 'date.unknown' });
  });
});

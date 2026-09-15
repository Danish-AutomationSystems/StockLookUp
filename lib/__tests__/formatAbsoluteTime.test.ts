import { describe, it, expect } from 'vitest';
import { formatAbsoluteTime } from '@/lib/formatAbsoluteTime';

describe('formatAbsoluteTime', () => {
  it('formats an ISO timestamp as "D MMM YYYY, h:mm AM/PM <tz>"', () => {
    const isoString = '2026-09-15T09:43:00.000Z';
    const result = formatAbsoluteTime(isoString);

    // Day, short month, year, comma, time with AM/PM, then a timezone label.
    expect(result).toMatch(/^\d{1,2} [A-Za-z]{3,4} \d{4}, \d{1,2}:\d{2}\s?[AaPp]\.?[Mm]\.?\s+\S+$/);
  });

  it('reflects the underlying instant (not a fixed string)', () => {
    const morning = formatAbsoluteTime('2026-09-15T04:00:00.000Z');
    const evening = formatAbsoluteTime('2026-09-15T18:00:00.000Z');
    expect(morning).not.toBe(evening);
  });
});

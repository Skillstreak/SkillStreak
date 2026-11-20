import { isNameBuilderName } from './village-team-name.util';
import { buildPreviewSports } from './village-preview';
import { VILLAGE_SPORTS } from './village.types';

describe('buildPreviewSports', () => {
  const bucket = new Date('2026-11-20T10:15:00Z');

  it('covers every sport with ten distinct name-builder names', () => {
    const sports = buildPreviewSports(bucket);
    expect(sports.map((s) => s.sport)).toEqual([...VILLAGE_SPORTS]);
    for (const sport of sports) {
      const names = sport.arenas.map((a) => a.name);
      expect(names).toHaveLength(10);
      expect(new Set(names).size).toBe(10);
      for (const name of names) expect(isNameBuilderName(name)).toBe(true);
      expect(sport.arenas.map((a) => a.slot)).toEqual(
        names.map((_, i) => `s${i + 1}`),
      );
    }
  });

  it('is stable within a bucket and changes between buckets', () => {
    expect(buildPreviewSports(bucket)).toEqual(buildPreviewSports(bucket));
    const later = new Date(bucket.getTime() + 15 * 60 * 1000);
    expect(buildPreviewSports(later)).not.toEqual(buildPreviewSports(bucket));
  });
});

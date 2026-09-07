/**
 * The single query-key factory (spec 10.3).
 *
 * Every key in the app is built here. Inline arrays scattered through screens are how
 * invalidation quietly stops working: one caller writes `['places', id]`, another writes
 * `['place', id]`, and a mutation invalidates neither.
 *
 * Keys are hierarchical, so a broad invalidation cascades — invalidating `village.all`
 * drops profile, stats, places and notices for that village in one call.
 */
export const keys = {
  geo: {
    all: ['geo'] as const,
    children: (parentId: string | null) => ['geo', 'children', parentId] as const,
  },
  me: {
    all: ['me'] as const,
    profile: () => ['me', 'profile'] as const,
    privacy: () => ['me', 'privacy'] as const,
  },
  village: {
    all: (villageId: string) => ['village', villageId] as const,
    profile: (villageId: string) => ['village', villageId, 'profile'] as const,
    stats: (villageId: string) => ['village', villageId, 'stats'] as const,
    notices: (villageId: string) => ['village', villageId, 'notices'] as const,
    directory: (villageId: string) => ['village', villageId, 'directory'] as const,
  },
} as const;

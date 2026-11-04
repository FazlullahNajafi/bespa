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
    unit: (id: string) => ['geo', 'unit', id] as const,
  },
  weather: {
    all: ['weather'] as const,
    /** Keyed by coordinate, not by village: two villages sharing a block share a forecast. */
    at: (lat: number | null, lon: number | null) => ['weather', lat, lon] as const,
    point: () => ['weather', 'point'] as const,
  },
  me: {
    all: ['me'] as const,
    profile: () => ['me', 'profile'] as const,
    privacy: () => ['me', 'privacy'] as const,
    /** The owner-only half — phone and verification. Never persisted to disk. */
    private: () => ['me', 'private'] as const,
    /** Which geo units this user administers, if any (spec 02.1). */
    adminUnits: () => ['me', 'adminUnits'] as const,
  },
  village: {
    all: (villageId: string) => ['village', villageId] as const,
    profile: (villageId: string) => ['village', villageId, 'profile'] as const,
    stats: (villageId: string) => ['village', villageId, 'stats'] as const,
    notices: (villageId: string) => ['village', villageId, 'notices'] as const,
    notice: (villageId: string, id: string) => ['village', villageId, 'notices', id] as const,
    directory: (villageId: string) => ['village', villageId, 'directory'] as const,
    /** The panchayat's own contact cards, pinned above the directory (spec 03.4). */
    contacts: (villageId: string) => ['village', villageId, 'contacts'] as const,
    places: (villageId: string) => ['village', villageId, 'places'] as const,
    placesPending: (villageId: string) => ['village', villageId, 'places', 'pending'] as const,
    /**
     * Keyed by the question, not by the village: the duplicate prompt asks "what else of
     * this category is within 150 m of *here*", and `here` changes as a pin is dragged.
     */
    placesNear: (category: string | null, lat: number | null, lon: number | null) =>
      ['village', 'placesNear', category, lat, lon] as const,
    gallery: (villageId: string) => ['village', villageId, 'gallery'] as const,
    galleryPending: (villageId: string) => ['village', villageId, 'gallery', 'pending'] as const,
    banner: (villageId: string) => ['village', villageId, 'banner'] as const,
    /** Keyed by object path, not by village: a signed URL belongs to one object. */
    imageUrl: (path: string) => ['village', 'image', path] as const,
  },
} as const;

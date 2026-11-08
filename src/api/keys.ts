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
    /** A village plus the block and district above it, for Home's header. */
    chain: (id: string) => ['geo', 'chain', id] as const,
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
  /**
   * Rides are **not** under `village`: a trip runs Kargil → Leh and its passengers come
   * from a dozen villages, so nothing here is scoped by one. Invalidating `['rides']`
   * after any write drops the board, the seat map and the bookings together, which is
   * what a booking actually changes.
   */
  rides: {
    all: ['rides'] as const,
    trips: (from: string | null, to: string | null, date: string | null) =>
      ['rides', 'trips', from, to, date] as const,
    trip: (tripId: string) => ['rides', 'trip', tripId] as const,
    myTrips: () => ['rides', 'myTrips'] as const,
    bookings: () => ['rides', 'bookings'] as const,
    vehicles: () => ['rides', 'vehicles'] as const,
    /** The short-distance board. Polled, so it is its own key. */
    board: () => ['rides', 'board'] as const,
  },
  /**
   * Driver verification. Its own branch, not under `rides`: a licence outlives any one
   * trip, and invalidating every ride query because a document was reviewed would drop
   * the board for no reason.
   */
  driver: {
    all: ['driver'] as const,
    documents: () => ['driver', 'documents'] as const,
    verified: () => ['driver', 'verified'] as const,
    queue: () => ['driver', 'queue'] as const,
    badges: (ids: string[]) => ['driver', 'badges', ids] as const,
    docUrl: (path: string) => ['driver', 'docUrl', path] as const,
  },
} as const;

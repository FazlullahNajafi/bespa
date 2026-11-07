import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { toErrorCode, type ErrorCode } from '@/lib/errors';
import { keys } from './keys';

/**
 * Long-distance rides (spec 04.2, 04.3) — a working prototype.
 *
 * **These calls do not go through the outbox, and that is the one deliberate exception
 * to spec 10.3.** Everywhere else, queueing a write and reporting "it will send" is
 * right: a photo, a notice, a place are all things that can arrive tomorrow. A seat
 * cannot. Holding seat 3 is a claim against other people in real time, and a hold that
 * drains out of a queue twenty minutes later would hand someone a seat that was taken
 * while their phone was in their pocket — or worse, tell them they have one when they do
 * not. So the ride calls are direct, they fail honestly when offline, and the screen
 * says so.
 *
 * **No Realtime subscription either.** Spec 04.6 wants seats to grey out within a second
 * across every open seat map, and that is right for launch. For a prototype a short
 * `staleTime` plus a refetch when the screen regains focus is enough to run a two-phone
 * test, and it costs nothing to replace later — the server is already the source of
 * truth, so adding a subscription changes no schema and no RPC.
 */

export type TripStatus =
  | 'open' | 'filling' | 'confirmed' | 'departed' | 'completed' | 'cancelled';
export type SeatStatus = 'free' | 'held' | 'booked' | 'blocked';
export type BookingStatus =
  | 'requested' | 'confirmed' | 'cancelled_by_passenger'
  | 'cancelled_by_driver' | 'no_show' | 'completed';
export type VehicleType =
  | 'xylo' | 'innova' | 'tempo_traveller' | 'bus_large'
  | 'omni' | 'eeco' | 'bus_small' | 'other';

export type Vehicle = {
  id: string;
  type: VehicleType;
  registration: string | null;
  seats: number;
};

export type TripSeat = {
  seat_no: number;
  status: SeatStatus;
  held_by: string | null;
  hold_expires_at: string | null;
};

export type Trip = {
  id: string;
  driver_id: string;
  from_label: string;
  to_label: string;
  departure_date: string;
  departure_window: string | null;
  price_per_seat: number;
  seats_total: number;
  pickup_note: string | null;
  contact_phone: string | null;
  status: TripStatus;
  cancel_reason: string | null;
  created_at: string;
  driver: { full_name: string } | null;
  vehicle: Vehicle | null;
  trip_seats: TripSeat[];
};

export type Booking = {
  id: string;
  trip_id: string;
  passenger_id: string;
  code: string;
  seat_nos: number[];
  phone: string | null;
  pickup_note: string | null;
  status: BookingStatus;
  created_at: string;
  passenger: { full_name: string } | null;
  trip: Trip | null;
};

const TRIP_COLUMNS =
  'id, driver_id, from_label, to_label, departure_date, departure_window, ' +
  'price_per_seat, seats_total, pickup_note, contact_phone, status, cancel_reason, created_at, ' +
  'driver:profiles!trips_driver_id_fkey(full_name), ' +
  'vehicle:vehicles(id, type, registration, seats), ' +
  'trip_seats(seat_no, status, held_by, hold_expires_at)';

/**
 * Seats still takeable, counted from the seat rows rather than a column on the trip.
 *
 * There is no `seats_available` counter to drift out of step, and the hold expiry is
 * applied here the same way the server applies it — a hold whose time has run out is a
 * free seat, whatever the row says.
 */
export function seatsFree(trip: Pick<Trip, 'trip_seats'>, now = Date.now()): number {
  return trip.trip_seats.filter(
    (seat) =>
      seat.status === 'free' ||
      (seat.status === 'held' &&
        seat.hold_expires_at !== null &&
        Date.parse(seat.hold_expires_at) < now),
  ).length;
}

/** Whether this seat can be tapped right now, by this user. */
export function seatTakeable(seat: TripSeat, me: string | null, now = Date.now()): boolean {
  if (seat.status === 'free') return true;
  if (seat.status !== 'held') return false;
  if (seat.held_by === me) return true;
  return seat.hold_expires_at !== null && Date.parse(seat.hold_expires_at) < now;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Trips on a corridor and date. District-wide: a trip is not village-scoped. */
export function useTrips(args: { from?: string; to?: string; date?: string }) {
  return useQuery({
    queryKey: keys.rides.trips(args.from ?? null, args.to ?? null, args.date ?? null),
    // Short, because a seat map goes stale in seconds while a trip is filling.
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Trip[]> => {
      let query = supabase
        .from('trips')
        .select(TRIP_COLUMNS)
        // A cancelled or departed trip is not on offer, and leaving it here was worse
        // than untidy: cancelling frees its seats, so the board advertised a cancelled
        // Gongma Minjee → Kargil run as "4 seats free". That is the failure that sends
        // somebody to a stand at five in the morning. Anyone who had booked still sees
        // it under My bookings, which reads bookings rather than the board.
        .in('status', ['open', 'filling', 'confirmed'])
        .gte('departure_date', new Date().toISOString().slice(0, 10))
        .order('departure_date')
        .limit(50);

      if (args.from) query = query.ilike('from_label', args.from);
      if (args.to) query = query.ilike('to_label', args.to);
      if (args.date) query = query.eq('departure_date', args.date);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Trip[];
    },
  });
}

export function useTrip(tripId: string | null | undefined) {
  return useQuery({
    queryKey: keys.rides.trip(tripId ?? 'none'),
    enabled: Boolean(tripId),
    // The seat map is the screen where staleness costs somebody a seat.
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 15,
    queryFn: async (): Promise<Trip | null> => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_COLUMNS)
        .eq('id', tripId as string)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as Trip | null) ?? null;
    },
  });
}

/** Trips this user is driving. */
export function useMyTrips(userId: string | null | undefined) {
  return useQuery({
    queryKey: keys.rides.myTrips(),
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_COLUMNS)
        .eq('driver_id', userId as string)
        .order('departure_date', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Trip[];
    },
  });
}

const BOOKING_COLUMNS =
  'id, trip_id, passenger_id, code, seat_nos, phone, pickup_note, status, created_at, ' +
  'passenger:profiles!bookings_passenger_id_fkey(full_name), ' +
  `trip:trips(${TRIP_COLUMNS})`;

/**
 * Every booking this user may see — theirs as a passenger, and everyone's on the trips
 * they drive. The policy decides which; this asks for rows and renders what comes back.
 */
export function useMyBookings(enabled: boolean) {
  return useQuery({
    queryKey: keys.rides.bookings(),
    enabled,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Booking[];
    },
  });
}

export function useMyVehicles(userId: string | null | undefined) {
  return useQuery({
    queryKey: keys.rides.vehicles(),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, type, registration, seats')
        .eq('owner_id', userId as string)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
  });
}

// ---------------------------------------------------------------------------
// Writing — direct, not queued. See the header.
// ---------------------------------------------------------------------------

export type RideResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

export function useSaveVehicle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      type: VehicleType;
      seats: number;
      registration?: string | null;
      vehicleId?: string | null;
    }): Promise<RideResult<string>> => {
      const { data, error } = await supabase.rpc('save_vehicle', {
        type: args.type,
        seats: args.seats,
        registration: args.registration ?? undefined,
        vehicle_id: args.vehicleId ?? undefined,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: data as string };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useCreateTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      vehicleId: string;
      fromLabel: string;
      toLabel: string;
      date: string;
      pricePerSeat: number;
      seatsTotal: number;
      window?: string | null;
      pickupNote?: string | null;
      contactPhone?: string | null;
    }): Promise<RideResult<string>> => {
      const { data, error } = await supabase.rpc('create_trip', {
        vehicle: args.vehicleId,
        from_label: args.fromLabel,
        to_label: args.toLabel,
        departure_date: args.date,
        price_per_seat: args.pricePerSeat,
        seats_total: args.seatsTotal,
        departure_window: args.window ?? undefined,
        pickup_note: args.pickupNote ?? undefined,
        contact_phone: args.contactPhone ?? undefined,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: data as string };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

/**
 * Claim seats. Returns **the seats actually won**, which may be fewer than asked for —
 * that is the normal case when two people are choosing at once, and the screen says so
 * rather than pretending.
 */
export function useHoldSeats() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tripId: string;
      seatNos: number[];
    }): Promise<RideResult<number[]>> => {
      const { data, error } = await supabase.rpc('hold_seats', {
        trip: args.tripId,
        seat_nos: args.seatNos,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: (data ?? []) as number[] };
    },
    onSuccess: (_r, args) =>
      void client.invalidateQueries({ queryKey: keys.rides.trip(args.tripId) }),
  });
}

export function useReleaseHolds() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('release_my_holds', { trip: tripId });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: (_r, tripId) =>
      void client.invalidateQueries({ queryKey: keys.rides.trip(tripId) }),
  });
}

export function useBookSeats() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tripId: string;
      seatNos: number[];
      phone?: string | null;
      pickupNote?: string | null;
    }): Promise<RideResult<{ booking_id: string; code: string }>> => {
      const { data, error } = await supabase.rpc('book_seats', {
        trip: args.tripId,
        seat_nos: args.seatNos,
        phone: args.phone ?? undefined,
        pickup_note: args.pickupNote ?? undefined,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      const row = (data as { booking_id: string; code: string }[] | null)?.[0];
      if (!row) return { ok: false, code: 'unknown' };
      return { ok: true, data: row };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useCancelBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('cancel_booking', { booking: bookingId });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useConfirmBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('confirm_booking', { booking: bookingId });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useCancelTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tripId: string;
      reason: string;
    }): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('cancel_trip', {
        trip: args.tripId,
        reason: args.reason,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

// ---------------------------------------------------------------------------
// The short-distance live board (spec 04.4)
// ---------------------------------------------------------------------------

/**
 * The other transport economy. Spec 04 refuses to merge the two, and this half has no
 * booking in it at all: a driver says "I am at the stand with four seats", it shows for
 * 45 minutes, and it expires on its own. Tapping "I'm coming" is a courtesy signal with
 * a ten-minute life, not a contract.
 */
export type LiveRide = {
  id: string;
  driver_id: string;
  driver_name: string | null;
  vehicle: VehicleType;
  registration: string | null;
  from_label: string;
  to_label: string;
  seats_free: number;
  claimed: number;
  fare: number | null;
  stand_note: string | null;
  went_live_at: string;
  expires_at: string;
  /** The number the driver published when going live — never their profile's. */
  contact: string | null;
};

/** What is left after the claims already pending are taken off. */
export function liveSeatsLeft(ride: LiveRide): number {
  return Math.max(0, ride.seats_free - ride.claimed);
}

export function useLiveBoard(enabled: boolean) {
  return useQuery({
    queryKey: keys.rides.board(),
    enabled,
    // A stand board is only worth anything if it is current. Spec 04.4 wants Realtime;
    // until that is wired, a 20-second poll is close enough to "the numbers just change"
    // and costs one small request.
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 20,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<LiveRide[]> => {
      const { data, error } = await supabase.rpc('live_board');
      if (error) throw error;
      return (data ?? []) as LiveRide[];
    },
  });
}

export function useGoLive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      vehicleId: string;
      fromLabel: string;
      toLabel: string;
      seatsFree: number;
      fare?: number | null;
      standNote?: string | null;
      contactPhone?: string | null;
    }): Promise<RideResult<string>> => {
      const { data, error } = await supabase.rpc('go_live', {
        vehicle: args.vehicleId,
        from_label: args.fromLabel,
        to_label: args.toLabel,
        seats_free: args.seatsFree,
        fare: args.fare ?? undefined,
        stand_note: args.standNote ?? undefined,
        contact_phone: args.contactPhone ?? undefined,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: data as string };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useSetLiveSeats() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      liveId: string;
      seatsFree: number;
    }): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('set_live_seats', {
        live: args.liveId,
        seats_free: args.seatsFree,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.rides.board() }),
  });
}

export function useEndLive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      liveId: string;
      reason: string;
    }): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('end_live', {
        live: args.liveId,
        reason: args.reason,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useClaimLiveSeat() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      liveId: string;
      pickupNote?: string | null;
    }): Promise<RideResult<true>> => {
      const { error } = await supabase.rpc('claim_live_seat', {
        live: args.liveId,
        pickup_note: args.pickupNote ?? undefined,
      });
      if (error) return { ok: false, code: toErrorCode(error) };
      return { ok: true, data: true };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.rides.board() }),
  });
}

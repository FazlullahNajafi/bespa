import * as Crypto from 'expo-crypto';

import { toErrorCode, type ErrorCode } from '@/lib/errors';
import { getConnectivity } from '@/lib/net';
import { all, count, due, insert, remove, reschedule, type OutboxRow } from './db';
import { backoffMs, isExhausted, isPermanent } from './policy';

/**
 * The outbox (spec 10.4 step 5, spec 10.3 rule 2).
 *
 * Every mutation goes through here, **including when online**. That is the rule worth
 * keeping: if the offline path is a separate branch, it is only ever exercised on a
 * plane, and it is broken by the time anyone flies. One code path means the queue is
 * tested by every write the app makes.
 *
 * Writing to SQLite first also makes a mutation survive the app being killed mid-request,
 * which a plain fetch does not.
 *
 * The catch, and the reason `submit` is shaped the way it is: some callers need the
 * server's answer. "You changed village 3 days ago" is something the picker has to
 * render, not an exception to swallow. So `submit` enqueues for durability and then,
 * when there is a connection, drains that row immediately and hands back the real result.
 * Offline, it returns `queued` and the caller shows a pending state.
 */

export type SubmitResult<T> =
  | { status: 'done'; value: T }
  | { status: 'queued'; id: string }
  | { status: 'failed'; code: ErrorCode };

type Handler = (payload: unknown, mediaPaths: string[]) => Promise<unknown>;

const handlers = new Map<string, Handler>();

/**
 * Registered by `src/api/*` modules at import time, so the drain can run a queued row
 * long after the screen that created it is gone — on a cold start, for instance, where
 * no component has mounted yet.
 */
export function registerHandler<P, R>(
  kind: string,
  handler: (payload: P, mediaPaths: string[]) => Promise<R>,
) {
  handlers.set(kind, handler as Handler);
}

const subscribers = new Set<() => void>();
let draining = false;

function notify() {
  subscribers.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  subscribers.add(fn);
  // Wrapped rather than returned directly: `Set.delete` yields a boolean, and React
  // rejects a cleanup function that returns anything.
  return () => {
    subscribers.delete(fn);
  };
}

export const pendingCount = count;
export const pendingRows = all;

/**
 * Queue a mutation and, if possible, carry it out now.
 *
 * `idempotencyKey` is what makes a retry safe: the row is unique on it, so submitting the
 * same logical write twice (a double tap, a retry after a response was lost) inserts
 * once. Callers that represent one specific action should pass a stable key.
 */
export async function submit<T>(args: {
  kind: string;
  payload: unknown;
  mediaPaths?: string[];
  idempotencyKey?: string;
}): Promise<SubmitResult<T>> {
  const id = Crypto.randomUUID();
  const row: OutboxRow = {
    id,
    idempotency_key: args.idempotencyKey ?? id,
    kind: args.kind,
    payload: JSON.stringify(args.payload),
    media_paths: JSON.stringify(args.mediaPaths ?? []),
    attempts: 0,
    next_attempt_at: 0,
    last_error: null,
    created_at: Date.now(),
  };

  await insert(row);
  notify();

  if (!getConnectivity().online) return { status: 'queued', id };

  const outcome = await run(row);
  notify();

  if (outcome.kind === 'done') return { status: 'done', value: outcome.value as T };
  if (outcome.kind === 'permanent') return { status: 'failed', code: outcome.code };
  // Transient: the row stays queued and the drain will pick it up.
  return { status: 'queued', id };
}

type RunOutcome =
  | { kind: 'done'; value: unknown }
  | { kind: 'permanent'; code: ErrorCode }
  | { kind: 'transient'; message: string };

async function run(row: OutboxRow): Promise<RunOutcome> {
  const handler = handlers.get(row.kind);
  if (!handler) {
    // A row whose handler is gone would otherwise retry forever. This happens when a
    // build removes a feature while a queued row from the previous build survives.
    await remove(row.id);
    return { kind: 'permanent', code: 'unknown' };
  }

  try {
    const payload = JSON.parse(row.payload) as unknown;
    const mediaPaths = JSON.parse(row.media_paths) as string[];
    const value = await handler(payload, mediaPaths);
    await remove(row.id);
    return { kind: 'done', value };
  } catch (error) {
    const code = toErrorCode(error);
    if (isPermanent(code)) {
      await remove(row.id);
      return { kind: 'permanent', code };
    }

    const message = error instanceof Error ? error.message : String(error);
    if (isExhausted(row.attempts + 1)) {
      // Give up on automatic retries but keep the row: it is the user's unsent work, and
      // deleting it silently is worse than showing it as stuck.
      await reschedule(row.id, Number.MAX_SAFE_INTEGER, message);
    } else {
      await reschedule(row.id, Date.now() + backoffMs(row.attempts), message);
    }
    return { kind: 'transient', message };
  }
}

/**
 * Work the queue until nothing is due. Called on reconnect and at app start.
 *
 * Single-flight: a reconnect event and a fresh submit can both fire within a frame of
 * each other, and two concurrent drains would run the same row twice.
 */
export async function drain(): Promise<void> {
  if (draining || !getConnectivity().online) return;
  draining = true;
  try {
    for (;;) {
      const rows = await due(Date.now());
      if (rows.length === 0) break;

      for (const row of rows) {
        if (!getConnectivity().online) return;
        await run(row);
      }
      notify();
    }
  } finally {
    draining = false;
    notify();
  }
}

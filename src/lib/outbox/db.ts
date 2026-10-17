import * as SQLite from 'expo-sqlite';

/**
 * The outbox table (spec 10.4 step 5).
 *
 * SQLite rather than AsyncStorage because this is a queue with ordering, counters and
 * partial failure, and because a half-written JSON blob in AsyncStorage loses every
 * pending write at once. A row either committed or it did not.
 */

export type OutboxRow = {
  id: string;
  idempotency_key: string;
  kind: string;
  /** JSON. Whatever the handler for `kind` needs. */
  payload: string;
  /** JSON array of local file URIs to upload before the handler runs. */
  media_paths: string;
  attempts: number;
  /** Epoch ms. Rows are invisible to the drain until now passes this. */
  next_attempt_at: number;
  last_error: string | null;
  created_at: number;
};

let db: SQLite.SQLiteDatabase | null = null;

/**
 * `next_attempt_at` and `last_error` are additions to the column list in spec 10.4.
 * Backoff needs somewhere to record when a row becomes eligible again — deriving it from
 * `attempts` alone would retry the whole queue the instant the app reopened — and a
 * failure the user may be asked about needs its reason kept.
 */
const SCHEMA = `
  create table if not exists outbox (
    id              text primary key not null,
    idempotency_key text not null unique,
    kind            text not null,
    payload         text not null,
    media_paths     text not null default '[]',
    attempts        integer not null default 0,
    next_attempt_at integer not null default 0,
    last_error      text,
    created_at      integer not null
  );
  create index if not exists outbox_due on outbox (next_attempt_at, created_at);
`;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('bespa-outbox.db');
  // WAL: the drain reads while a screen may be enqueueing, and the default journal mode
  // makes one of them wait.
  await db.execAsync('pragma journal_mode = WAL;');
  await db.execAsync(SCHEMA);
  return db;
}

export async function insert(row: OutboxRow): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `insert or ignore into outbox
       (id, idempotency_key, kind, payload, media_paths, attempts, next_attempt_at, last_error, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.idempotency_key,
    row.kind,
    row.payload,
    row.media_paths,
    row.attempts,
    row.next_attempt_at,
    row.last_error,
    row.created_at,
  );
}

/** Rows whose backoff has elapsed, oldest first — a queue, not a set. */
export async function due(now: number, limit = 20): Promise<OutboxRow[]> {
  const database = await getDb();
  return database.getAllAsync<OutboxRow>(
    'select * from outbox where next_attempt_at <= ? order by created_at asc limit ?',
    now,
    limit,
  );
}

export async function remove(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('delete from outbox where id = ?', id);
}

export async function reschedule(id: string, nextAttemptAt: number, error: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'update outbox set attempts = attempts + 1, next_attempt_at = ?, last_error = ? where id = ?',
    nextAttemptAt,
    error.slice(0, 500),
    id,
  );
}

export async function count(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ n: number }>('select count(*) as n from outbox');
  return row?.n ?? 0;
}

export async function all(): Promise<OutboxRow[]> {
  const database = await getDb();
  return database.getAllAsync<OutboxRow>('select * from outbox order by created_at asc');
}

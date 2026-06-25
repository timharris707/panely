/**
 * session-lock.ts — In-memory file-level mutex for session JSON files.
 *
 * Prevents concurrent read-modify-write races on session files by serializing
 * access per session ID. All routes that mutate session state should use
 * withSessionLock() instead of raw readFileSync/writeFileSync.
 */

const locks = new Map<string, Promise<unknown>>();

/**
 * Serialize access to a session file by session ID.
 * Queued callers wait for the prior holder to finish before running.
 */
export async function withSessionLock<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for any existing lock to release, then run fn
  const prev = locks.get(sessionId) ?? Promise.resolve();

  let resolve!: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  locks.set(sessionId, next);

  try {
    await prev;
    return await fn();
  } finally {
    resolve();
    // Clean up if we're the last in the chain
    if (locks.get(sessionId) === next) {
      locks.delete(sessionId);
    }
  }
}

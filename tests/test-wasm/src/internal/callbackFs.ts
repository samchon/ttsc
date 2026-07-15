// Promise adapters over the low-level `IWasmExecFS` errback API.
//
// The MemFS mutation methods (`rename`, `rmdir`, `unlink`, `truncate`,
// `ftruncate`, `open`, `read`, `write`) all follow Node's `callback(err, ...)`
// convention. The Go/wasm runtime is the real caller; these adapters let the
// tests drive the exact same entry points and assert on the settled result
// instead of nesting callbacks.
import type { IFileStats, IWasmExecFS } from "@ttsc/wasm";

/** A rejected `IWasmExecFS` callback error, carrying its POSIX `code`. */
export interface IFsError extends Error {
  code?: string;
}

/** Await a no-result mutation (`rename`/`rmdir`/`unlink`/`truncate`/…). */
export function callMutation(
  run: (cb: (err: IFsError | null) => void) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    run((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Await a mutation and return its rejection `code` (or `null` on success). Lets
 * a negative-twin assertion pin the exact POSIX error a rejected mutation must
 * carry without a try/catch per case.
 */
export async function expectFsError(
  run: (cb: (err: IFsError | null) => void) => void,
): Promise<string | null> {
  try {
    await callMutation(run);
    return null;
  } catch (err) {
    return (err as IFsError).code ?? "UNKNOWN";
  }
}

/** Read the sorted immediate child names of directory `path`. */
export function readdir(fs: IWasmExecFS, path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    fs.readdir(path, (err, entries) => (err ? reject(err) : resolve(entries)));
  });
}

/** Stat `path` and resolve to its `IFileStats`. */
export function stat(fs: IWasmExecFS, path: string): Promise<IFileStats> {
  return new Promise<IFileStats>((resolve, reject) => {
    fs.stat(path, (err, stats) => (err ? reject(err) : resolve(stats)));
  });
}

/** Open `path` with the given flags and resolve to its file descriptor. */
export function openFd(
  fs: IWasmExecFS,
  path: string,
  flags: number,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    fs.open(path, flags, 0o644, (err, fd) => (err ? reject(err) : resolve(fd)));
  });
}

/**
 * Read up to `length` bytes from `fd` at the current position and return the
 * decoded UTF-8 text of exactly the bytes reported read.
 */
export function readFdText(
  fs: IWasmExecFS,
  fd: number,
  length: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const buffer = new Uint8Array(length);
    fs.read(fd, buffer, 0, length, null, (err, n) =>
      err
        ? reject(err)
        : resolve(new TextDecoder().decode(buffer.subarray(0, n))),
    );
  });
}

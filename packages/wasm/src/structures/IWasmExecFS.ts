import type { IFileStats } from "./IFileStats";

/**
 * Subset of the Node.js `fs` module that `wasm_exec.js` calls into.
 *
 * Go's js/wasm runtime routes all `syscall/js` filesystem operations through
 * `globalThis.fs`. In a browser there is no real `fs`, so a MemFS
 * implementation fulfils this interface. Only the operations that
 * typescript-go's compiler exercises are required; the rest are no-ops or
 * return `EPERM`/`EINVAL`.
 */
export interface IWasmExecFS {
  constants: Record<string, number>;
  writeSync(fd: number, buf: Uint8Array): number;
  write(
    fd: number,
    buf: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
    callback: (err: NodeJS.ErrnoException | null, n: number) => void,
  ): void;
  open(
    path: string,
    flags: number,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null, fd: number) => void,
  ): void;
  close(
    fd: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
    callback: (err: NodeJS.ErrnoException | null, n: number) => void,
  ): void;
  readdir(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, entries: string[]) => void,
  ): void;
  mkdir(
    path: string,
    perm: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  stat(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, stats: IFileStats) => void,
  ): void;
  lstat(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, stats: IFileStats) => void,
  ): void;
  fstat(
    fd: number,
    callback: (err: NodeJS.ErrnoException | null, stats: IFileStats) => void,
  ): void;
  fsync(
    fd: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  unlink(
    path: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  rename(
    from: string,
    to: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  rmdir(
    path: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  chmod(
    path: string,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  fchmod(
    fd: number,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  chown(
    path: string,
    uid: number,
    gid: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  fchown(
    fd: number,
    uid: number,
    gid: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  lchown(
    path: string,
    uid: number,
    gid: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  utimes(
    path: string,
    atime: number,
    mtime: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  link(
    path: string,
    link: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  symlink(
    path: string,
    link: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  readlink(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, link: string) => void,
  ): void;
  truncate(
    path: string,
    length: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  ftruncate(
    fd: number,
    length: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;
  /**
   * JavaScript-only pipe emulation. Returns two fds: a read end and a write
   * end.
   *
   * Installing this does **not** make Go's wasm `os.Pipe()` work. Under the
   * pinned Go toolchain neither `GOOS=js` nor `GOOS=wasip1` has pipes:
   * `os.Pipe` returns an `ENOSYS` syscall error and `syscall.Pipe` returns
   * `ENOSYS`, and neither one crosses the `globalThis.fs` bridge, so no
   * JavaScript method is ever consulted. A custom Go/wasm host cannot reach
   * this shim.
   *
   * The host captures wasm output without pipes: process-level writes to fd 1
   * and fd 2 land in `stdout.buffer` and `stderr.buffer` through `writeSync`,
   * and a plugin's output is collected by the Go-side `host.InvokePlugin` into
   * invocation-owned in-process buffers.
   */
  pipe2(
    flags: number,
    callback: (
      err: NodeJS.ErrnoException | null,
      fds: [number, number],
    ) => void,
  ): void;
}

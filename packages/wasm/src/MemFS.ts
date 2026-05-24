// MemFS implements just enough of the wasm_exec.js fs interface for an
// in-browser ttsc wasm to run.
//
// Why this exists: wasm_exec.js routes Go's syscalls (open / stat / read /
// write / readdir / mkdir / ...) to `globalThis.fs`. In Node, that maps to the
// real fs module. In browsers we have to supply our own. The set we implement
// here is the smallest subset typescript-go actually exercises for a project
// compile of a tiny in-memory project.
//
// All callbacks follow the Node "errback" convention: callback(err, result).
// Errors carry a `code` (e.g. ENOENT, EBADF) so Go's os package sees them as
// proper os.PathError values.
//
// Files are stored as Uint8Array. String input passed to writeFile is encoded,
// byte input is copied, and readFile returns a copy so callers cannot mutate
// stored filesystem state by keeping a reference.

/** Mode bits exposed by stat. We only differentiate file vs directory. */
const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const DEFAULT_FILE_MODE = S_IFREG | 0o644;
const DEFAULT_DIR_MODE = S_IFDIR | 0o755;

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
  // pipe2 is what Go's wasm `os.Pipe()` calls. Returns two fds: a read end
  // and a write end. The host's stdout/stderr capture currently uses MemFS
  // temp files, but this keeps direct pipe callers compatible with the wasm
  // fs surface.
  pipe2(
    flags: number,
    callback: (
      err: NodeJS.ErrnoException | null,
      fds: [number, number],
    ) => void,
  ): void;
}

/**
 * Stat-like object returned by `stat`, `lstat`, and `fstat`.
 *
 * Mirrors the subset of `fs.Stats` that `wasm_exec.js` reads. Fields not
 * relevant to Go's `os.FileInfo` (e.g. ownership) are zeroed.
 */
export interface IFileStats {
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
  mode: number;
  mtimeMs: number;
  atimeMs: number;
  ctimeMs: number;
  dev: number;
  ino: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  blksize: number;
  blocks: number;
}

/** Internal filesystem tree node. Directories carry an empty `data` buffer. */
interface INode {
  kind: "file" | "dir";
  data: Uint8Array;
  mtimeMs: number;
}

/**
 * Filesystem error with a POSIX error code and numeric `errno`.
 *
 * Matches the shape of `NodeJS.ErrnoException` so Go's os package interprets it
 * as a proper `os.PathError` with a numeric error code.
 */
export class MemFSError extends Error {
  public code: string;
  public errno: number;
  public path?: string;
  public syscall?: string;
  constructor(code: string, syscall: string, path?: string) {
    super(`${code}: ${syscall} ${path ?? ""}`.trim());
    this.code = code;
    this.errno = errnoForCode(code);
    this.path = path;
    this.syscall = syscall;
  }
}

/** Map a POSIX error name to its Linux numeric errno (negative by convention). */
function errnoForCode(code: string): number {
  switch (code) {
    case "ENOENT":
      return -2;
    case "EBADF":
      return -9;
    case "EEXIST":
      return -17;
    case "ENOTDIR":
      return -20;
    case "EISDIR":
      return -21;
    case "EINVAL":
      return -22;
    case "ESPIPE":
      return -29;
    default:
      return -1;
  }
}

/**
 * Handle returned by `createMemFS`. Provides the `fs` shim to install on
 * `globalThis` plus convenience methods for seeding the virtual filesystem
 * before booting the wasm.
 */
export interface IMemFSHost {
  fs: IWasmExecFS;
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string): Uint8Array | null;
  readFileText(path: string): string | null;
  exists(path: string): boolean;
  mkdirp(path: string): void;
  stdout: { buffer: string };
  stderr: { buffer: string };
  resetStdio(): void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Resolve a path to an absolute, normalized POSIX path.
 *
 * Collapses `.` and `..` segments and converts backslashes. Returns `"/"` for
 * empty input.
 */
function normalize(p: string): string {
  if (!p) return "/";
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return "/" + stack.join("/");
}

/**
 * Create an in-memory filesystem suitable for use as `globalThis.fs` inside a
 * Go/wasm runtime.
 *
 * The returned host exposes the low-level `fs` object (install it on
 * `globalThis.fs` before loading `wasm_exec.js`) and convenience helpers
 * (`writeFile`, `readFile`, `mkdirp`, …) for seeding source files and reading
 * compiler output without touching the real filesystem.
 */
export function createMemFS(): IMemFSHost {
  const nodes = new Map<string, INode>();
  nodes.set("/", { kind: "dir", data: new Uint8Array(), mtimeMs: Date.now() });

  const stdout = { buffer: "" };
  const stderr = { buffer: "" };

  const fdTable = new Map<
    number,
    { path: string; position: number; isStdout?: boolean; isStderr?: boolean }
  >();
  let nextFd = 100;
  // Reserve 1/2 for stdout/stderr writeSync routing.
  fdTable.set(1, { path: "/dev/stdout", position: 0, isStdout: true });
  fdTable.set(2, { path: "/dev/stderr", position: 0, isStderr: true });

  // Pipe state. fs.pipe2 mints a pair of fds backed by a shared queue;
  // writes append, reads consume. The state is keyed by fd so a single Map
  // lookup in read/write/close can detect "this is a pipe end" without
  // changing the existing fdTable entries.
  interface IPipeState {
    buffers: Uint8Array[];
    pendingReaders: Array<{
      buffer: Uint8Array;
      offset: number;
      length: number;
      callback: (err: NodeJS.ErrnoException | null, n: number) => void;
    }>;
    readFd: number;
    writeFd: number;
    writeClosed: boolean;
  }
  const pipes = new Map<number, IPipeState>();

  /**
   * Drain buffered pipe data into `buffer[offset..offset+length]`. Returns
   * bytes copied.
   */
  function drainPipeInto(
    state: IPipeState,
    buffer: Uint8Array,
    offset: number,
    length: number,
  ): number {
    let written = 0;
    while (state.buffers.length > 0 && written < length) {
      const chunk = state.buffers[0]!;
      const copyLen = Math.min(chunk.byteLength, length - written);
      buffer.set(chunk.subarray(0, copyLen), offset + written);
      written += copyLen;
      if (copyLen >= chunk.byteLength) state.buffers.shift();
      else state.buffers[0] = chunk.subarray(copyLen);
    }
    return written;
  }

  /**
   * Satisfy any pending blocked readers using available pipe data or EOF
   * signal.
   */
  function flushPipeReaders(state: IPipeState): void {
    while (
      state.pendingReaders.length > 0 &&
      (state.buffers.length > 0 || state.writeClosed)
    ) {
      const reader = state.pendingReaders.shift()!;
      const n = drainPipeInto(
        state,
        reader.buffer,
        reader.offset,
        reader.length,
      );
      // Even at EOF (writeClosed && empty buffers) we satisfy with n=0 which
      // signals EOF to the Go-side caller.
      reader.callback(null, n);
    }
  }

  /** Silently create any missing ancestor directories for path `p`. */
  function ensureParentDirs(p: string): void {
    const segments = normalize(p).split("/").filter(Boolean);
    segments.pop();
    let cursor = "";
    for (const seg of segments) {
      cursor += "/" + seg;
      if (!nodes.has(cursor)) {
        nodes.set(cursor, {
          kind: "dir",
          data: new Uint8Array(),
          mtimeMs: Date.now(),
        });
      }
    }
  }

  function mkdirp(p: string): void {
    const segments = normalize(p).split("/").filter(Boolean);
    let cursor = "";
    for (const seg of segments) {
      cursor += "/" + seg;
      const existing = nodes.get(cursor);
      if (!existing) {
        nodes.set(cursor, {
          kind: "dir",
          data: new Uint8Array(),
          mtimeMs: Date.now(),
        });
      } else if (existing.kind !== "dir") {
        throw new MemFSError("ENOTDIR", "mkdir", cursor);
      }
    }
  }

  function writeFile(p: string, data: string | Uint8Array): void {
    const norm = normalize(p);
    ensureParentDirs(norm);
    const bytes =
      typeof data === "string" ? encoder.encode(data) : new Uint8Array(data);
    nodes.set(norm, { kind: "file", data: bytes, mtimeMs: Date.now() });
  }

  function readFile(p: string): Uint8Array | null {
    const node = nodes.get(normalize(p));
    if (!node || node.kind !== "file") return null;
    return new Uint8Array(node.data);
  }

  function readFileText(p: string): string | null {
    const bytes = readFile(p);
    return bytes === null ? null : decoder.decode(bytes);
  }

  function exists(p: string): boolean {
    return nodes.has(normalize(p));
  }

  /** Synchronously stat `p`; throws `MemFSError("ENOENT")` if not found. */
  function statSync(p: string): IFileStats {
    const norm = normalize(p);
    const node = nodes.get(norm);
    if (!node) throw new MemFSError("ENOENT", "stat", norm);
    return makeStats(node);
  }

  /** Build an `IFileStats` object from a filesystem node. */
  function makeStats(node: INode): IFileStats {
    const isDir = node.kind === "dir";
    return {
      isDirectory: () => isDir,
      isFile: () => !isDir,
      size: node.data.byteLength,
      mode: isDir ? DEFAULT_DIR_MODE : DEFAULT_FILE_MODE,
      mtimeMs: node.mtimeMs,
      atimeMs: node.mtimeMs,
      ctimeMs: node.mtimeMs,
      dev: 0,
      ino: 0,
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 4096,
      blocks: Math.ceil(node.data.byteLength / 512),
    };
  }

  /**
   * Return immediate children of directory `p`, sorted alphabetically.
   *
   * Uses a linear scan over the node map and a `Set` to deduplicate nested
   * paths into direct-child names — O(n) in the number of total nodes.
   */
  function readdirSync(p: string): string[] {
    const norm = normalize(p);
    const node = nodes.get(norm);
    if (!node) throw new MemFSError("ENOENT", "readdir", norm);
    if (node.kind !== "dir") throw new MemFSError("ENOTDIR", "readdir", norm);
    const prefix = norm === "/" ? "/" : norm + "/";
    const direct = new Set<string>();
    for (const key of nodes.keys()) {
      if (!key.startsWith(prefix) || key === norm) continue;
      const rest = key.slice(prefix.length);
      const cut = rest.indexOf("/");
      direct.add(cut === -1 ? rest : rest.slice(0, cut));
    }
    return [...direct].sort();
  }

  const fs: IWasmExecFS = {
    constants: {
      O_WRONLY: 1,
      O_RDWR: 2,
      O_CREAT: 64,
      O_TRUNC: 512,
      O_APPEND: 1024,
      O_EXCL: 128,
      O_DIRECTORY: 65536,
    },

    writeSync(fd, buf) {
      if (fd === 1) {
        stdout.buffer += decoder.decode(buf);
        return buf.length;
      }
      if (fd === 2) {
        const text = decoder.decode(buf);
        stderr.buffer += text;
        // Surface wasm-side stderr to the host console in real-time so plugin
        // debug prints / Go panics aren't trapped inside the MemFS buffer.
        // Stripped at end of message for cleaner display.
        const line = text.replace(/\n$/, "");
        if (line.length > 0)
          // eslint-disable-next-line no-console
          console.error("[wasm]", line);
        return buf.length;
      }
      // Open-file fds (>= 100): append to the underlying file. This is the
      // path the wasm host's runWithCapturedIO uses to capture plugin
      // stdout/stderr via /tmp/* temp files (os.Pipe is not implemented on
      // js/wasm so we mirror its semantics via files).
      const entry = fdTable.get(fd);
      if (entry) {
        const node = nodes.get(entry.path);
        if (node && node.kind === "file") {
          // subarray(0) is a zero-copy view over the full incoming buffer; the
          // bytes are copied into `next` before writeSync returns.
          const incoming = buf.subarray(0);
          const existing = node.data;
          const next = new Uint8Array(
            existing.byteLength + incoming.byteLength,
          );
          next.set(existing, 0);
          next.set(incoming, existing.byteLength);
          node.data = next;
          node.mtimeMs = Date.now();
          entry.position = next.byteLength;
          return incoming.byteLength;
        }
      }
      // Unknown fd. Fall back to the stderr buffer so the bytes aren't lost
      // entirely (and surface as a console.error so the regression is
      // visible to whoever's looking).
      stderr.buffer += decoder.decode(buf);
      // eslint-disable-next-line no-console
      console.error(
        "[wasm] writeSync to unknown fd " +
          fd +
          " (" +
          buf.byteLength +
          " bytes); routed to stderr buffer",
      );
      return buf.length;
    },

    write(fd, buf, offset, length, position, callback) {
      try {
        // Pipe write: snapshot the data (caller may reuse `buf`) and queue.
        // Synchronously wake any blocked reader so the cooperative wasm
        // scheduler doesn't deadlock waiting for a future fs roundtrip.
        const pipeState = pipes.get(fd);
        if (pipeState) {
          if (fd !== pipeState.writeFd) {
            callback(new MemFSError("EBADF", "write"), 0);
            return;
          }
          if (length > 0) {
            const copy = new Uint8Array(length);
            copy.set(buf.subarray(offset, offset + length));
            pipeState.buffers.push(copy);
            flushPipeReaders(pipeState);
          }
          callback(null, length);
          return;
        }
        if (position !== null && position !== 0) {
          callback(new MemFSError("ESPIPE", "write"), 0);
          return;
        }
        const view = buf.subarray(offset, offset + length);
        const written = this.writeSync(fd, view);
        callback(null, written);
      } catch (err) {
        callback(err as NodeJS.ErrnoException, 0);
      }
    },

    open(p, flags, _mode, callback) {
      const norm = normalize(p);
      const node = nodes.get(norm);
      const creating = (flags & (this.constants.O_CREAT ?? 0)) !== 0;
      if (!node) {
        if (!creating) {
          callback(new MemFSError("ENOENT", "open", norm), -1);
          return;
        }
        ensureParentDirs(norm);
        nodes.set(norm, {
          kind: "file",
          data: new Uint8Array(),
          mtimeMs: Date.now(),
        });
      }
      const fd = nextFd++;
      fdTable.set(fd, { path: norm, position: 0 });
      if ((flags & (this.constants.O_TRUNC ?? 0)) !== 0) {
        nodes.set(norm, {
          kind: "file",
          data: new Uint8Array(),
          mtimeMs: Date.now(),
        });
      }
      callback(null, fd);
    },

    close(fd, callback) {
      const pipeState = pipes.get(fd);
      if (pipeState) {
        if (fd === pipeState.writeFd) {
          pipeState.writeClosed = true;
          flushPipeReaders(pipeState);
        }
        pipes.delete(fd);
        callback(null);
        return;
      }
      if (!fdTable.has(fd)) {
        callback(new MemFSError("EBADF", "close"));
        return;
      }
      if (fd > 2) fdTable.delete(fd);
      callback(null);
    },

    read(fd, buffer, offset, length, position, callback) {
      // Pipe read: drain queued chunks; block (defer callback) on empty.
      // Empty + writeClosed → return 0 (EOF). Position is ignored for pipes.
      const pipeState = pipes.get(fd);
      if (pipeState) {
        if (fd !== pipeState.readFd) {
          callback(new MemFSError("EBADF", "read"), 0);
          return;
        }
        if (pipeState.buffers.length > 0) {
          const n = drainPipeInto(pipeState, buffer, offset, length);
          callback(null, n);
          return;
        }
        if (pipeState.writeClosed) {
          callback(null, 0);
          return;
        }
        pipeState.pendingReaders.push({ buffer, offset, length, callback });
        return;
      }
      const entry = fdTable.get(fd);
      if (!entry) {
        callback(new MemFSError("EBADF", "read"), 0);
        return;
      }
      const node = nodes.get(entry.path);
      if (!node || node.kind !== "file") {
        callback(new MemFSError("ENOENT", "read", entry.path), 0);
        return;
      }
      const start = position ?? entry.position;
      const end = Math.min(start + length, node.data.byteLength);
      const slice = node.data.subarray(start, end);
      buffer.set(slice, offset);
      if (position === null) entry.position = end;
      callback(null, slice.byteLength);
    },

    readdir(p, callback) {
      try {
        callback(null, readdirSync(p));
      } catch (err) {
        callback(err as NodeJS.ErrnoException, []);
      }
    },

    mkdir(p, _perm, callback) {
      try {
        mkdirp(p);
        callback(null);
      } catch (err) {
        callback(err as NodeJS.ErrnoException);
      }
    },

    stat(p, callback) {
      try {
        callback(null, statSync(p));
      } catch (err) {
        callback(
          err as NodeJS.ErrnoException,
          undefined as unknown as IFileStats,
        );
      }
    },

    lstat(p, callback) {
      this.stat(p, callback);
    },

    fstat(fd, callback) {
      // fstat against a pipe end returns a synthetic file-stat. Go's
      // os.Pipe-backed File uses fstat at construction time to populate
      // Stat_t; without this it errors and falls back to invalid fds.
      if (pipes.has(fd)) {
        callback(
          null,
          makeStats({
            kind: "file",
            data: new Uint8Array(),
            mtimeMs: Date.now(),
          }),
        );
        return;
      }
      const entry = fdTable.get(fd);
      if (!entry) {
        callback(
          new MemFSError("EBADF", "fstat"),
          undefined as unknown as IFileStats,
        );
        return;
      }
      try {
        callback(null, statSync(entry.path));
      } catch (err) {
        callback(
          err as NodeJS.ErrnoException,
          undefined as unknown as IFileStats,
        );
      }
    },

    fsync(_fd, callback) {
      callback(null);
    },

    unlink(p, callback) {
      const norm = normalize(p);
      if (!nodes.has(norm)) {
        callback(new MemFSError("ENOENT", "unlink", norm));
        return;
      }
      nodes.delete(norm);
      callback(null);
    },

    rename(from, to, callback) {
      const src = normalize(from);
      const node = nodes.get(src);
      if (!node) {
        callback(new MemFSError("ENOENT", "rename", src));
        return;
      }
      const dest = normalize(to);
      nodes.delete(src);
      nodes.set(dest, node);
      callback(null);
    },

    rmdir(p, callback) {
      this.unlink(p, callback);
    },

    chmod(_p, _mode, callback) {
      callback(null);
    },
    fchmod(_fd, _mode, callback) {
      callback(null);
    },
    chown(_p, _uid, _gid, callback) {
      callback(null);
    },
    fchown(_fd, _uid, _gid, callback) {
      callback(null);
    },
    lchown(_p, _uid, _gid, callback) {
      callback(null);
    },
    utimes(_p, _atime, _mtime, callback) {
      callback(null);
    },
    link(_p, _link, callback) {
      callback(new MemFSError("EPERM", "link"));
    },
    symlink(_p, _link, callback) {
      callback(new MemFSError("EPERM", "symlink"));
    },
    readlink(_p, callback) {
      callback(new MemFSError("EINVAL", "readlink"), "");
    },
    truncate(_p, _length, callback) {
      callback(null);
    },
    ftruncate(_fd, _length, callback) {
      callback(null);
    },
    pipe2(_flags, callback) {
      const readFd = nextFd++;
      const writeFd = nextFd++;
      const state: IPipeState = {
        buffers: [],
        pendingReaders: [],
        readFd,
        writeFd,
        writeClosed: false,
      };
      pipes.set(readFd, state);
      pipes.set(writeFd, state);
      callback(null, [readFd, writeFd]);
    },
  };

  return {
    fs,
    writeFile,
    readFile,
    readFileText,
    exists,
    mkdirp,
    stdout,
    stderr,
    resetStdio() {
      stdout.buffer = "";
      stderr.buffer = "";
    },
  };
}

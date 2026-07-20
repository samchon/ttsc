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
import { MemFSError } from "./MemFSError";
import type { IFileStats } from "./structures/IFileStats";
import type { IMemFSHost } from "./structures/IMemFSHost";
import type { IWasmExecFS } from "./structures/IWasmExecFS";

/** Mode bits exposed by stat. We only differentiate file vs directory. */
const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const DEFAULT_FILE_MODE = S_IFREG | 0o644;
const DEFAULT_DIR_MODE = S_IFDIR | 0o755;

/** Internal filesystem tree node. Directories carry an empty `data` buffer. */
interface INode {
  kind: "file" | "dir";
  data: Uint8Array;
  mtimeMs: number;
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
 *
 * Every successful mutation leaves a valid tree: `/` stays a directory, each
 * proper ancestor of a node exists and is a directory, and a file has no
 * descendants. An operation that cannot satisfy that throws (`writeFile`,
 * `mkdirp`) or reports a POSIX error through its callback, having changed no
 * node, byte, or descriptor.
 */
export function createMemFS(): IMemFSHost {
  const nodes = new Map<string, INode>();
  nodes.set("/", { kind: "dir", data: new Uint8Array(), mtimeMs: Date.now() });

  const stdout = { buffer: "" };
  const stderr = { buffer: "" };

  /**
   * One open descriptor.
   *
   * `readable`, `writable`, and `append` are the access mode and `O_APPEND`
   * flag captured at `open`; without them no read or write below can tell an
   * allowed operation from a forbidden one. `position` is the cursor a
   * `position: null` read or write uses and advances, exactly as Node's `fs`
   * defines it.
   */
  interface IDescriptor {
    path: string;
    position: number;
    readable: boolean;
    writable: boolean;
    append: boolean;
    isStdout?: boolean;
    isStderr?: boolean;
  }
  const fdTable = new Map<number, IDescriptor>();
  let nextFd = 100;
  // Reserve 1/2 for stdout/stderr writeSync routing.
  fdTable.set(1, {
    path: "/dev/stdout",
    position: 0,
    readable: false,
    writable: true,
    append: true,
    isStdout: true,
  });
  fdTable.set(2, {
    path: "/dev/stderr",
    position: 0,
    readable: false,
    writable: true,
    append: true,
    isStderr: true,
  });

  // Pipe state. fs.pipe2 mints a pair of fds backed by a shared queue;
  // writes append, reads consume. The state is keyed by fd so a single Map
  // lookup in read/write/close can detect "this is a pipe end" without
  // changing the existing fdTable entries.
  //
  // These fds only ever come from a direct JavaScript `fs.pipe2` call. Go's
  // wasm `os.Pipe` returns ENOSYS without crossing the `globalThis.fs` bridge,
  // so the Go runtime never reaches this state — see IWasmExecFS.pipe2.
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

  /** Root-to-leaf path of every segment of `norm` (`/a/b` → `["/a", "/a/b"]`). */
  function pathChain(norm: string): string[] {
    const chain: string[] = [];
    let cursor = "";
    for (const seg of norm.split("/").filter(Boolean)) {
      cursor += "/" + seg;
      chain.push(cursor);
    }
    return chain;
  }

  /**
   * Validate that every path in root-to-leaf `chain` is or can become a
   * directory, and report the ones that do not exist yet.
   *
   * A segment that exists as a file makes everything below it impossible: a
   * file has no descendants, so creating one there would leave a node map that
   * is not a tree. Validation is deliberately separate from creation so every
   * caller can reject before touching anything, and so a rejected operation
   * never leaves half a directory chain behind.
   */
  function missingDirs(chain: string[], syscall: string): string[] {
    const missing: string[] = [];
    for (const path of chain) {
      const existing = nodes.get(path);
      if (!existing) missing.push(path);
      else if (existing.kind !== "dir")
        throw new MemFSError("ENOTDIR", syscall, path);
    }
    return missing;
  }

  /** Materialize the directories `missingDirs` reported. */
  function createDirs(paths: string[]): void {
    for (const path of paths)
      nodes.set(path, {
        kind: "dir",
        data: new Uint8Array(),
        mtimeMs: Date.now(),
      });
  }

  /**
   * Validate that normalized path `norm` may hold a regular file, returning the
   * node already there when one exists.
   *
   * A directory is never silently replaced by a file — including the root,
   * which is a directory node like any other. POSIX answers `EISDIR`, and
   * overwriting the node here would strand every descendant in the map behind a
   * path `readdir` can no longer walk.
   */
  function assertFileTarget(norm: string, syscall: string): INode | undefined {
    const existing = nodes.get(norm);
    if (existing && existing.kind !== "file")
      throw new MemFSError("EISDIR", syscall, norm);
    return existing;
  }

  /** Absolute parent directory of a normalized path (`/` for a top-level path). */
  function parentDir(norm: string): string {
    const idx = norm.lastIndexOf("/");
    return idx <= 0 ? "/" : norm.slice(0, idx);
  }

  /** True when `dir` has at least one descendant node in the tree. */
  function hasChildren(dir: string): boolean {
    const prefix = dir === "/" ? "/" : dir + "/";
    for (const key of nodes.keys()) {
      if (key !== dir && key.startsWith(prefix)) return true;
    }
    return false;
  }

  /**
   * Grow or shrink a file's byte buffer to exactly `length`, zero-filling any
   * extension. Callers validate `length >= 0` first.
   */
  function resizeFileData(data: Uint8Array, length: number): Uint8Array {
    const next = new Uint8Array(length);
    next.set(data.subarray(0, Math.min(length, data.byteLength)));
    return next;
  }

  /**
   * Write `view` through descriptor `entry` and return the bytes stored.
   *
   * Three offsets are possible and only one of them is right per call: an
   * `O_APPEND` descriptor always writes at end-of-file, an explicit `position`
   * writes exactly there without disturbing the cursor (POSIX `pwrite`), and
   * `position: null` writes at the cursor and advances it. A write that starts
   * past end-of-file zero-fills the gap rather than silently relocating.
   *
   * A zero-byte write changes nothing at all, so a cursor sitting past
   * end-of-file cannot extend the file by writing nothing into it.
   */
  function writeThroughDescriptor(
    entry: IDescriptor,
    view: Uint8Array,
    position: number | null,
    syscall: string,
  ): number {
    if (!entry.writable) throw new MemFSError("EBADF", syscall, entry.path);
    const node = nodes.get(entry.path);
    if (!node) throw new MemFSError("ENOENT", syscall, entry.path);
    if (node.kind !== "file")
      throw new MemFSError("EISDIR", syscall, entry.path);
    const start = entry.append
      ? node.data.byteLength
      : (position ?? entry.position);
    if (!Number.isInteger(start) || start < 0)
      throw new MemFSError("EINVAL", syscall, entry.path);
    if (view.byteLength === 0) return 0;
    const end = start + view.byteLength;
    if (end > node.data.byteLength) node.data = resizeFileData(node.data, end);
    node.data.set(view, start);
    node.mtimeMs = Date.now();
    if (position === null || entry.append) entry.position = end;
    return view.byteLength;
  }

  /**
   * Move the entire subtree rooted at `src` to `dest`, overwriting any existing
   * `dest` node. Every descendant key is re-parented so no old-prefix node is
   * left orphaned, and open descriptors that referenced a moved path follow to
   * the new location (a rename must not strand an fd's inode).
   */
  function moveSubtree(src: string, dest: string): void {
    const srcPrefix = src + "/";
    const moves: Array<[string, INode]> = [];
    for (const [key, node] of nodes) {
      if (key === src) moves.push([dest, node]);
      else if (key.startsWith(srcPrefix))
        moves.push([dest + "/" + key.slice(srcPrefix.length), node]);
    }
    // Delete the whole source subtree first so a nested overwrite cannot leave
    // a stale descendant behind, then reinsert at the destination prefix. Any
    // pre-existing `dest` node is replaced by the reinsert.
    for (const key of [...nodes.keys()]) {
      if (key === src || key.startsWith(srcPrefix)) nodes.delete(key);
    }
    for (const [key, node] of moves) nodes.set(key, node);
    for (const entry of fdTable.values()) {
      if (entry.path === src) entry.path = dest;
      else if (entry.path.startsWith(srcPrefix))
        entry.path = dest + "/" + entry.path.slice(srcPrefix.length);
    }
  }

  function mkdirp(p: string): void {
    // Validate the whole chain before creating any of it: a rejected mkdirp
    // must not leave the prefix it had already walked past behind.
    createDirs(missingDirs(pathChain(normalize(p)), "mkdir"));
  }

  function writeFile(p: string, data: string | Uint8Array): void {
    const norm = normalize(p);
    // Resolve left to right the way POSIX does: an impossible ancestor is
    // reported before the target, and both are checked before any mutation.
    const missing = missingDirs(pathChain(norm).slice(0, -1), "open");
    const existing = assertFileTarget(norm, "open");
    const bytes =
      typeof data === "string" ? encoder.encode(data) : new Uint8Array(data);
    createDirs(missing);
    // Overwriting keeps the same node so descriptors already pointing at this
    // file observe the replacement instead of a detached predecessor.
    if (existing) {
      existing.data = bytes;
      existing.mtimeMs = Date.now();
    } else nodes.set(norm, { kind: "file", data: bytes, mtimeMs: Date.now() });
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
      // Open-file fds (>= 100): write at the descriptor cursor, the way Node's
      // own `writeSync` without a position does. Browser-hosted tools use this
      // path for ordinary virtual files and explicit outputs.
      //
      // An unknown or already-closed fd throws instead of being diverted into
      // the captured stderr: reporting the byte count of a write nobody
      // performed made the caller continue on a false success and quietly
      // contaminated a diagnostic channel consumers read.
      const entry = fdTable.get(fd);
      if (!entry) throw new MemFSError("EBADF", "write");
      // subarray(0) is a zero-copy view over the full incoming buffer; the
      // bytes are copied into the node before writeSync returns.
      return writeThroughDescriptor(entry, buf.subarray(0), null, "write");
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
        const view = buf.subarray(offset, offset + length);
        // The stdout/stderr capture buffers are streams, not files: they have
        // no seekable offset, so an explicit position is meaningless on them.
        if (fd === 1 || fd === 2) {
          if (position !== null && position !== 0)
            throw new MemFSError("ESPIPE", "write");
          callback(null, this.writeSync(fd, view));
          return;
        }
        const entry = fdTable.get(fd);
        if (!entry) throw new MemFSError("EBADF", "write");
        callback(null, writeThroughDescriptor(entry, view, position, "write"));
      } catch (err) {
        callback(err as NodeJS.ErrnoException, 0);
      }
    },

    // Every rejection happens before the first mutation and before a
    // descriptor is minted, so a refused open leaves neither a half-created
    // node nor a leaked fd behind.
    open(p, flags, _mode, callback) {
      try {
        const norm = normalize(p);
        const creating = (flags & (this.constants.O_CREAT ?? 0)) !== 0;
        const exclusive = (flags & (this.constants.O_EXCL ?? 0)) !== 0;
        const truncating = (flags & (this.constants.O_TRUNC ?? 0)) !== 0;
        const appending = (flags & (this.constants.O_APPEND ?? 0)) !== 0;
        const directoryOnly = (flags & (this.constants.O_DIRECTORY ?? 0)) !== 0;
        // The access mode is the low bits of `flags`: absent both means
        // read-only, and `O_RDWR` alongside `O_WRONLY` still grants both.
        const writeOnly = (flags & (this.constants.O_WRONLY ?? 0)) !== 0;
        const readWrite = (flags & (this.constants.O_RDWR ?? 0)) !== 0;
        const writable = writeOnly || readWrite;
        const readable = !writeOnly || readWrite;

        let node = nodes.get(norm);
        if (!node) {
          if (!creating) throw new MemFSError("ENOENT", "open", norm);
          // `open` can only ever create a regular file, so a caller demanding a
          // directory cannot be satisfied by creating one.
          if (directoryOnly) throw new MemFSError("ENOTDIR", "open", norm);
          // Creating the missing ancestor chain is the documented job of
          // `writeFile` and `mkdirp`; the low-level `open` never promised it.
          const missing = missingDirs(pathChain(norm).slice(0, -1), "open");
          if (missing.length > 0)
            throw new MemFSError("ENOENT", "open", missing[0]!);
          node = { kind: "file", data: new Uint8Array(), mtimeMs: Date.now() };
          nodes.set(norm, node);
        } else {
          if (creating && exclusive)
            throw new MemFSError("EEXIST", "open", norm);
          if (node.kind === "dir") {
            // A directory opens read-only — Go stats the fd and lists the path
            // that way. Writing to it or truncating it would turn it into a
            // file and orphan every descendant.
            if (writable || truncating)
              throw new MemFSError("EISDIR", "open", norm);
          } else if (directoryOnly)
            throw new MemFSError("ENOTDIR", "open", norm);
        }
        if (truncating) {
          node.data = new Uint8Array();
          node.mtimeMs = Date.now();
        }
        const fd = nextFd++;
        fdTable.set(fd, {
          path: norm,
          position: 0,
          readable,
          writable,
          append: appending,
        });
        callback(null, fd);
      } catch (err) {
        callback(err as NodeJS.ErrnoException, -1);
      }
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
      // A write-only descriptor is not a readable one. POSIX answers EBADF for
      // an operation the descriptor's access mode never granted.
      if (!entry.readable) {
        callback(new MemFSError("EBADF", "read", entry.path), 0);
        return;
      }
      const node = nodes.get(entry.path);
      if (!node || node.kind !== "file") {
        callback(new MemFSError("ENOENT", "read", entry.path), 0);
        return;
      }
      const start = position ?? entry.position;
      if (!Number.isInteger(start) || start < 0) {
        callback(new MemFSError("EINVAL", "read", entry.path), 0);
        return;
      }
      const end = Math.min(start + length, node.data.byteLength);
      const slice = node.data.subarray(start, end);
      buffer.set(slice, offset);
      // The cursor advances by the bytes actually read. Assigning `end` would
      // rewind a cursor already past end-of-file (after `ftruncate`, say) back
      // onto live bytes and make the next sequential write overwrite them.
      if (position === null) entry.position = start + slice.byteLength;
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
      // fstat against a pipe end returns a synthetic file-stat so a direct
      // JavaScript caller that wraps the fd in a file-like abstraction can
      // populate its stat fields. A pipe end has no node in the tree.
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
      const node = nodes.get(norm);
      if (!node) {
        callback(new MemFSError("ENOENT", "unlink", norm));
        return;
      }
      // POSIX unlink refuses directories (EISDIR/EPERM). Go's os.Remove tries
      // unlink first and only falls back to rmdir when it fails, so a false
      // success here would delete just the directory node and orphan every
      // descendant. Reject so the rmdir path (which validates emptiness) runs.
      if (node.kind === "dir") {
        callback(new MemFSError("EISDIR", "unlink", norm));
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
      if (src === "/") {
        callback(new MemFSError("EBUSY", "rename", src));
        return;
      }
      const dest = normalize(to);
      // Renaming a path onto itself is a defined no-op success.
      if (src === dest) {
        callback(null);
        return;
      }
      // A directory cannot be moved inside itself or its own descendants.
      if (node.kind === "dir" && dest.startsWith(src + "/")) {
        callback(new MemFSError("EINVAL", "rename", src));
        return;
      }
      // The destination's parent must already exist as a directory.
      const parent = nodes.get(parentDir(dest));
      if (!parent) {
        callback(new MemFSError("ENOENT", "rename", dest));
        return;
      }
      if (parent.kind !== "dir") {
        callback(new MemFSError("ENOTDIR", "rename", dest));
        return;
      }
      // Reconcile against an existing destination before mutating anything so a
      // rejected rename leaves the tree untouched (no partial state).
      const destNode = nodes.get(dest);
      if (destNode) {
        if (node.kind === "file") {
          if (destNode.kind === "dir") {
            callback(new MemFSError("EISDIR", "rename", dest));
            return;
          }
        } else if (destNode.kind !== "dir") {
          callback(new MemFSError("ENOTDIR", "rename", dest));
          return;
        } else if (hasChildren(dest)) {
          callback(new MemFSError("ENOTEMPTY", "rename", dest));
          return;
        }
      }
      moveSubtree(src, dest);
      callback(null);
    },

    rmdir(p, callback) {
      const norm = normalize(p);
      const node = nodes.get(norm);
      if (!node) {
        callback(new MemFSError("ENOENT", "rmdir", norm));
        return;
      }
      if (node.kind !== "dir") {
        callback(new MemFSError("ENOTDIR", "rmdir", norm));
        return;
      }
      if (norm === "/") {
        callback(new MemFSError("EBUSY", "rmdir", norm));
        return;
      }
      if (hasChildren(norm)) {
        callback(new MemFSError("ENOTEMPTY", "rmdir", norm));
        return;
      }
      nodes.delete(norm);
      callback(null);
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
    truncate(p, length, callback) {
      const norm = normalize(p);
      const node = nodes.get(norm);
      if (!node) {
        callback(new MemFSError("ENOENT", "truncate", norm));
        return;
      }
      if (node.kind !== "file") {
        callback(new MemFSError("EISDIR", "truncate", norm));
        return;
      }
      if (!Number.isInteger(length) || length < 0) {
        callback(new MemFSError("EINVAL", "truncate", norm));
        return;
      }
      node.data = resizeFileData(node.data, length);
      node.mtimeMs = Date.now();
      callback(null);
    },
    ftruncate(fd, length, callback) {
      // Pipe ends and the reserved stdout/stderr fds have no truncatable file.
      if (pipes.has(fd)) {
        callback(new MemFSError("EINVAL", "ftruncate"));
        return;
      }
      const entry = fdTable.get(fd);
      if (!entry) {
        callback(new MemFSError("EBADF", "ftruncate"));
        return;
      }
      if (entry.isStdout || entry.isStderr) {
        callback(new MemFSError("EINVAL", "ftruncate"));
        return;
      }
      const node = nodes.get(entry.path);
      if (!node || node.kind !== "file") {
        callback(new MemFSError("EINVAL", "ftruncate", entry.path));
        return;
      }
      if (!Number.isInteger(length) || length < 0) {
        callback(new MemFSError("EINVAL", "ftruncate", entry.path));
        return;
      }
      node.data = resizeFileData(node.data, length);
      node.mtimeMs = Date.now();
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

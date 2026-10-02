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

  /** UTF-8 decoding of current bytes, cleared by every content mutation. */
  text?: string;
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
 *
 * @evidence contracts/common.md#principled-implementation
 *   The owned Node-shaped fs bridge uses maps for virtual node/descriptor
 *   identity and preserves opened nodes independently from paths. The Go js/wasm
 *   callback interface is the authority; unsupported link and metadata mutation
 *   capabilities are explicit in IWasmExecFS.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One closure owns the tree, indexes and descriptor identities. Shared helpers
 *   centralize path validation, insertion/removal and byte mutation; separate
 *   stream captures and pipe queues reflect non-seekable lifetimes rather than
 *   adding filesystem nodes that would blur their operation contracts.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Virtual flag/errno values are bridge constants, not native-host guesses.
 *   The implementation owns its maps rather than patching foreign filesystem
 *   methods. Directory indexes, geometric file growth and linked pipe queues
 *   correct repeated global scans, full-buffer copies and queue shifts at their
 *   owners, without size exceptions or benchmark-specific paths.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain installation, copying and tree ownership; helper
 *   and interface comments state cost and unsupported capabilities. This follows
 *   the documentation skill's paragraph, units and rationale guidance.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Directory lookup visits D direct entries and sorts them in O(D log D),
 *   emptiness uses the indexed child count, and rename visits only S subtree
 *   nodes plus F open descriptors. Growing file writes amortize copying through
 *   geometric capacity; pipe enqueue/dequeue change linked endpoints in O(1).
 *   Path normalization costs O(P) path characters; ancestor validation builds
 *   d prefixes with total length K, costing O(K + d) time and temporary space
 *   under expected constant-time map access after hashing each prefix. Output fragments
 *   append without flattening prior text; reading a dirty B-byte capture costs
 *   O(B), while an unchanged capture read reuses its materialized string.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Child membership is maintained once by node insertion/deletion rather than
 *   reconstructed for every listing. Text decoding is cached on node identity
 *   and invalidated by every content mutation. Open descriptors share their
 *   actual inode; public byte reads still copy to preserve caller isolation.
 *   Each output stream keeps its own incremental UTF-8 decoder, so a split
 *   character is decoded once and capture reads reuse the materialized string
 *   until another fragment arrives.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Each host owns its tree, indexes, captures and descriptors. Unlink/rmdir
 *   remove tree entries, close releases descriptors, and consumed pipe entries
 *   are detached. File write capacity stays at most twice logical length; truncate
 *   and replacement release spare storage. Total input and captured output have
 *   no fixed bound, so the caller owns deletion, resetStdio and host lifetime.
 */
export function createMemFS(): IMemFSHost {
  const nodes = new Map<string, INode>();
  const children = new Map<string, Set<string>>([["/", new Set()]]);
  nodes.set("/", { kind: "dir", data: new Uint8Array(), mtimeMs: Date.now() });

  /** Keep parent membership and directory indexes with the owned node tree. */
  function setNode(p: string, node: INode): void {
    nodes.set(p, node);
    children.get(parentDir(p))!.add(p);
    if (node.kind === "dir" && !children.has(p)) children.set(p, new Set());
  }

  /** Remove a validated node and its index; open descriptors retain the node. */
  function deleteNode(p: string): void {
    nodes.delete(p);
    children.get(parentDir(p))!.delete(p);
    children.delete(p);
  }

  /** Decode stream fragments incrementally and materialize capture text on read. */
  function createCapture() {
    let streamDecoder = new TextDecoder();
    let chunks: string[] = [];
    let cached = "";
    let dirty = false;
    const append = (text: string): string => {
      if (text.length > 0) {
        chunks.push(text);
        cached = "";
        dirty = true;
      }
      return text;
    };
    return {
      output: {
        get buffer(): string {
          if (dirty) {
            cached = chunks.join("");
            chunks = cached.length > 0 ? [cached] : [];
            dirty = false;
          }
          return cached;
        },
        set buffer(value: string) {
          streamDecoder = new TextDecoder();
          chunks = value.length > 0 ? [value] : [];
          cached = value;
          dirty = false;
        },
      },
      write(bytes: Uint8Array): string {
        return append(streamDecoder.decode(bytes, { stream: true }));
      },
      flush(): void {
        append(streamDecoder.decode());
      },
    };
  }
  const stdout = createCapture();
  const stderr = createCapture();

  /**
   * One open descriptor.
   *
   * `node` retains the object opened even after its pathname is unlinked or
   * replaced. `readable`, `writable`, and `append` are the access mode and
   * `O_APPEND` flag captured at `open`; without them no descriptor mutation can
   * distinguish an allowed operation from a forbidden one. `position` is the
   * cursor a `position: null` read or write uses and advances.
   */
  interface IDescriptor {
    path: string;
    node?: INode;
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
  interface IQueueEntry<T> {
    value: T;
    next?: IQueueEntry<T>;
  }
  interface IQueue<T> {
    head?: IQueueEntry<T>;
    tail?: IQueueEntry<T>;
  }
  function enqueue<T>(queue: IQueue<T>, value: T): void {
    const entry = { value };
    if (queue.tail) queue.tail.next = entry;
    else queue.head = entry;
    queue.tail = entry;
  }
  function dequeue<T>(queue: IQueue<T>): T | undefined {
    const entry = queue.head;
    if (!entry) return undefined;
    queue.head = entry.next;
    if (!queue.head) queue.tail = undefined;
    return entry.value;
  }
  interface IPipeState {
    buffers: IQueue<Uint8Array>;
    pendingReaders: IQueue<{
      buffer: Uint8Array;
      offset: number;
      length: number;
      callback: (err: NodeJS.ErrnoException | null, n: number) => void;
    }>;
    readFd: number;
    writeFd: number;
    writeClosed: boolean;
    readClosed: boolean;
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
    while (state.buffers.head && written < length) {
      const chunk = state.buffers.head.value;
      const copyLen = Math.min(chunk.byteLength, length - written);
      buffer.set(chunk.subarray(0, copyLen), offset + written);
      written += copyLen;
      if (copyLen >= chunk.byteLength) dequeue(state.buffers);
      else state.buffers.head.value = chunk.subarray(copyLen);
    }
    return written;
  }

  /**
   * Satisfy any pending blocked readers using available pipe data or EOF
   * signal.
   */
  function flushPipeReaders(state: IPipeState): void {
    while (
      state.pendingReaders.head &&
      (state.buffers.head || state.writeClosed)
    ) {
      const reader = dequeue(state.pendingReaders)!;
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
      setNode(path, {
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
    return (children.get(dir)?.size ?? 0) > 0;
  }

  /**
   * Allocate zero-filled storage for a file of `length` bytes.
   *
   * The engine refuses a length it cannot allocate with a `RangeError`, which
   * carries no POSIX code and would escape a callback that promises one. That
   * refusal is the virtual filesystem's maximum file size, so it is reported as
   * `EFBIG`; the caller has not yet changed any node when this throws.
   */
  function allocateFileData(
    length: number,
    syscall: string,
    path: string,
  ): Uint8Array {
    try {
      return new Uint8Array(length);
    } catch (error) {
      if (error instanceof RangeError)
        throw new MemFSError("EFBIG", syscall, path);
      throw error;
    }
  }

  /**
   * Grow or shrink a file's byte buffer to exactly `length`, zero-filling any
   * extension. Callers validate `length >= 0` first.
   */
  function resizeFileData(
    data: Uint8Array,
    length: number,
    syscall: string,
    path: string,
  ): Uint8Array {
    const next = allocateFileData(length, syscall, path);
    next.set(data.subarray(0, Math.min(length, data.byteLength)));
    return next;
  }

  /** Grow writes geometrically; the public view still exposes only file bytes. */
  function growFileData(
    data: Uint8Array,
    length: number,
    syscall: string,
    path: string,
  ): Uint8Array {
    const capacity = data.buffer.byteLength - data.byteOffset;
    if (length <= capacity) {
      const next = new Uint8Array(data.buffer, data.byteOffset, length);
      next.fill(0, data.byteLength);
      return next;
    }
    // Spare capacity is only an optimization: when the engine refuses the
    // doubled size, the exact length still satisfies the write.
    let next: Uint8Array;
    if (data.byteLength * 2 > length) {
      try {
        next = allocateFileData(data.byteLength * 2, syscall, path);
      } catch {
        next = allocateFileData(length, syscall, path);
      }
    } else next = allocateFileData(length, syscall, path);
    next.set(data);
    return next.subarray(0, length);
  }

  /** Reject invalid byte slices before a write or queued read can mutate state. */
  function validSlice(buffer: Uint8Array, offset: number, length: number): boolean {
    return Number.isSafeInteger(offset) && Number.isSafeInteger(length) &&
      offset >= 0 && length >= 0 && offset <= buffer.byteLength &&
      length <= buffer.byteLength - offset;
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
    const node = entry.node;
    if (!node) throw new MemFSError("ENOENT", syscall, entry.path);
    if (node.kind !== "file")
      throw new MemFSError("EISDIR", syscall, entry.path);
    const start = entry.append
      ? node.data.byteLength
      : (position ?? entry.position);
    if (!Number.isSafeInteger(start) || start < 0)
      throw new MemFSError("EINVAL", syscall, entry.path);
    if (view.byteLength === 0) return 0;
    const end = start + view.byteLength;
    if (!Number.isSafeInteger(end))
      throw new MemFSError("EINVAL", syscall, entry.path);
    if (end > node.data.byteLength)
      node.data = growFileData(node.data, end, syscall, entry.path);
    node.data.set(view, start);
    node.text = undefined;
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
    const moves: Array<[string, string, INode]> = [];
    const pending = [src];
    while (pending.length > 0) {
      const key = pending.pop()!;
      const target = key === src ? dest : dest + key.slice(src.length);
      moves.push([key, target, nodes.get(key)!]);
      for (const child of children.get(key) ?? []) pending.push(child);
    }
    // Delete the whole source subtree first so a nested overwrite cannot leave
    // a stale descendant behind, then reinsert at the destination prefix. Any
    // pre-existing `dest` node is replaced by the reinsert.
    for (let i = moves.length - 1; i >= 0; --i) deleteNode(moves[i]![0]);
    if (nodes.has(dest)) deleteNode(dest);
    for (const [, key, node] of moves) setNode(key, node);
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
      existing.text = undefined;
      existing.mtimeMs = Date.now();
    } else setNode(norm, { kind: "file", data: bytes, mtimeMs: Date.now() });
  }

  function readFile(p: string): Uint8Array | null {
    const node = nodes.get(normalize(p));
    if (!node || node.kind !== "file") return null;
    return new Uint8Array(node.data);
  }

  function readFileText(p: string): string | null {
    const node = nodes.get(normalize(p));
    if (!node || node.kind !== "file") return null;
    return (node.text ??= decoder.decode(node.data));
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
   * Return immediate children of directory `p`, sorted by UTF-16 code unit.
   *
   * The maintained child index limits work to this directory's entries. Sorting
   * provides deterministic output without scanning unrelated project files.
   */
  function readdirSync(p: string): string[] {
    const norm = normalize(p);
    const node = nodes.get(norm);
    if (!node) throw new MemFSError("ENOENT", "readdir", norm);
    if (node.kind !== "dir") throw new MemFSError("ENOTDIR", "readdir", norm);
    return [...children.get(norm)!]
      .map((child) => child.slice(norm === "/" ? 1 : norm.length + 1))
      .sort();
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
        stdout.write(buf);
        return buf.length;
      }
      if (fd === 2) {
        const text = stderr.write(buf);
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
        if (!validSlice(buf, offset, length))
          throw new MemFSError("EINVAL", "write");
        // Pipe write: snapshot the data (caller may reuse `buf`) and queue.
        // Synchronously wake any blocked reader so the cooperative wasm
        // scheduler doesn't deadlock waiting for a future fs roundtrip.
        const pipeState = pipes.get(fd);
        if (pipeState) {
          if (fd !== pipeState.writeFd) {
            callback(new MemFSError("EBADF", "write"), 0);
            return;
          }
          if (pipeState.readClosed) {
            callback(new MemFSError("EPIPE", "write"), 0);
            return;
          }
          if (length > 0) {
            const copy = new Uint8Array(length);
            copy.set(buf.subarray(offset, offset + length));
            enqueue(pipeState.buffers, copy);
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
          setNode(norm, node);
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
          node.text = undefined;
          node.mtimeMs = Date.now();
        }
        const fd = nextFd++;
        fdTable.set(fd, {
          path: norm,
          node,
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
        pipes.delete(fd);
        if (fd === pipeState.writeFd) {
          pipeState.writeClosed = true;
          flushPipeReaders(pipeState);
        } else {
          pipeState.readClosed = true;
          pipeState.buffers = {};
          while (pipeState.pendingReaders.head) {
            const reader = dequeue(pipeState.pendingReaders)!;
            reader.callback(new MemFSError("EBADF", "read"), 0);
          }
        }
        callback(null);
        return;
      }
      if (!fdTable.has(fd)) {
        callback(new MemFSError("EBADF", "close"));
        return;
      }
      if (fd === 1) stdout.flush();
      if (fd === 2) stderr.flush();
      if (fd > 2) fdTable.delete(fd);
      callback(null);
    },

    read(fd, buffer, offset, length, position, callback) {
      if (!validSlice(buffer, offset, length)) {
        callback(new MemFSError("EINVAL", "read"), 0);
        return;
      }
      // Pipe read: drain queued chunks; block (defer callback) on empty.
      // Empty + writeClosed → return 0 (EOF). Position is ignored for pipes.
      const pipeState = pipes.get(fd);
      if (pipeState) {
        if (fd !== pipeState.readFd) {
          callback(new MemFSError("EBADF", "read"), 0);
          return;
        }
        if (length === 0) {
          callback(null, 0);
          return;
        }
        if (pipeState.buffers.head) {
          const n = drainPipeInto(pipeState, buffer, offset, length);
          callback(null, n);
          return;
        }
        if (pipeState.writeClosed) {
          callback(null, 0);
          return;
        }
        enqueue(pipeState.pendingReaders, { buffer, offset, length, callback });
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
      const node = entry.node;
      if (!node || node.kind !== "file") {
        callback(new MemFSError("ENOENT", "read", entry.path), 0);
        return;
      }
      const start = position ?? entry.position;
      if (!Number.isSafeInteger(start) || start < 0) {
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
        const norm = normalize(p);
        if (nodes.has(norm)) throw new MemFSError("EEXIST", "mkdir", norm);
        const parent = nodes.get(parentDir(norm));
        if (!parent) throw new MemFSError("ENOENT", "mkdir", parentDir(norm));
        if (parent.kind !== "dir")
          throw new MemFSError("ENOTDIR", "mkdir", parentDir(norm));
        setNode(norm, {
          kind: "dir",
          data: new Uint8Array(),
          mtimeMs: Date.now(),
        });
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
        if (!entry.node) throw new MemFSError("ENOENT", "fstat", entry.path);
        callback(null, makeStats(entry.node));
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
      deleteNode(norm);
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
      deleteNode(norm);
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
      try {
        node.data = resizeFileData(node.data, length, "truncate", norm);
      } catch (err) {
        callback(err as NodeJS.ErrnoException);
        return;
      }
      node.text = undefined;
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
      if (!entry.writable) {
        callback(new MemFSError("EBADF", "ftruncate", entry.path));
        return;
      }
      const node = entry.node;
      if (!node || node.kind !== "file") {
        callback(new MemFSError("EINVAL", "ftruncate", entry.path));
        return;
      }
      if (!Number.isInteger(length) || length < 0) {
        callback(new MemFSError("EINVAL", "ftruncate", entry.path));
        return;
      }
      try {
        node.data = resizeFileData(node.data, length, "ftruncate", entry.path);
      } catch (err) {
        callback(err as NodeJS.ErrnoException);
        return;
      }
      node.text = undefined;
      node.mtimeMs = Date.now();
      callback(null);
    },
    pipe2(_flags, callback) {
      const readFd = nextFd++;
      const writeFd = nextFd++;
      const state: IPipeState = {
        buffers: {},
        pendingReaders: {},
        readFd,
        writeFd,
        writeClosed: false,
        readClosed: false,
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
    stdout: stdout.output,
    stderr: stderr.output,
    resetStdio() {
      stdout.output.buffer = "";
      stderr.output.buffer = "";
    },
  };
}

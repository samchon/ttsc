import type { IFileStats } from "./IFileStats";

/**
 * Subset of the Node.js `fs` module that `wasm_exec.js` calls into.
 *
 * Go's js/wasm runtime routes all `syscall/js` filesystem operations through
 * `globalThis.fs`. In a browser there is no real `fs`, so a MemFS
 * implementation fulfils this interface. Only the operations that
 * typescript-go's compiler exercises are required; the rest are no-ops or
 * return `EPERM`/`EINVAL`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node-style callback signatures and open flags adapt Go's js/wasm filesystem
 *   bridge. The declared capability is virtual files/directories, not full POSIX.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Node-shaped verbs are the Go runtime's existing extension boundary. The
 *   interface separates seekable files, captured streams and unsupported links
 *   without introducing another protocol between the runtime and its host.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unsupported links remain explicit errors; permission/ownership/time setters
 *   are documented no-ops rather than hidden claims of native filesystem support.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc names bridge scope, callback conventions and capability limits,
 *   following the documentation skill's context and failure guidance.
 */
export interface IWasmExecFS {
  /** Virtual open-flag values consumed by the Go bridge. */
  constants: Record<string, number>;

  /**
   * Write all supplied bytes at a file cursor or to captured fd 1/2.
   *
   * @evidence contracts/common.md#principled-implementation Synchronous writes mirror the bridge's byte-buffer operation.
   * @evidence contracts/common.md#clear-and-simple-design The synchronous whole-buffer write is distinct from callback byte-slice writes because wasm_exec uses both call shapes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown descriptors throw rather than diverting writes to a diagnostic stream.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states descriptor and stream roles under the documentation skill's context guidance.
   */
  writeSync(fd: number, buf: Uint8Array): number;

  /**
   * Write a byte slice; null position uses the cursor, while append uses EOF.
   *
   * @evidence contracts/common.md#principled-implementation The Node callback operation separates buffer offsets from seek position.
   * @evidence contracts/common.md#clear-and-simple-design Byte slice, descriptor position and completion stay explicit instead of overloading one offset parameter.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Access mode and stream identity own dispatch, without guessing a destination from payload bytes.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states position and append meaning under the documentation skill's units guidance.
   */
  write(
    fd: number,
    buf: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
    callback: (err: NodeJS.ErrnoException | null, n: number) => void,
  ): void;

  /**
   * Open a virtual path with bridge flags; low-level creation requires its parent.
   *
   * @evidence contracts/common.md#principled-implementation Node-shaped flags select file access and the returned descriptor owns its cursor.
   * @evidence contracts/common.md#clear-and-simple-design One open boundary captures access flags and descriptor identity; recursive seeding remains outside this low-level operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Parent creation stays in writeFile/mkdirp instead of silently changing low-level open semantics.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains parent and descriptor ownership under the documentation skill's context guidance.
   */
  open(
    path: string,
    flags: number,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null, fd: number) => void,
  ): void;

  /**
   * Release an open descriptor; closing a pipe write end signals EOF to readers.
   *
   * @evidence contracts/common.md#principled-implementation Explicit close follows descriptor ownership and the virtual pipe's endpoint lifecycle.
   * @evidence contracts/common.md#clear-and-simple-design Descriptor release is one operation; file nodes and the two pipe endpoint roles keep their separate lifetimes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown descriptors remain errors rather than guessed already-closed successes.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains release and EOF effects under the documentation skill's ownership guidance.
   */
  close(
    fd: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Read a byte slice; null position advances the file cursor by bytes read.
   *
   * @evidence contracts/common.md#principled-implementation Node callback arguments distinguish destination-buffer offsets from file position.
   * @evidence contracts/common.md#clear-and-simple-design Explicit slice and seek parameters preserve the bridge contract without exposing internal cursor or queue objects.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor access mode owns reads; EOF does not rewind a cursor past the current file length.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states byte units and cursor movement under the documentation skill's units guidance.
   */
  read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
    callback: (err: NodeJS.ErrnoException | null, n: number) => void,
  ): void;

  /**
   * Return sorted immediate child names of a virtual directory.
   *
   * @evidence contracts/common.md#principled-implementation A Node-style names array exposes directory membership independently from stat data.
   * @evidence contracts/common.md#clear-and-simple-design Listing returns immediate names only, leaving metadata and recursion to their existing separate operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Entries come from the owned tree rather than expected source-file names.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states depth and order under the documentation skill's context guidance.
   */
  readdir(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, entries: string[]) => void,
  ): void;

  /**
   * Create one directory with an existing parent; virtual permissions are fixed.
   *
   * @evidence contracts/common.md#principled-implementation Single-directory creation remains distinct from the host's recursive seeding API.
   * @evidence contracts/common.md#clear-and-simple-design One-directory creation keeps bridge semantics visible rather than silently creating missing ancestor chains.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing nodes and missing parents remain errors instead of being rewritten to fit a requested path.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains creation depth and permission capability under the documentation skill's context guidance.
   */
  mkdir(
    path: string,
    perm: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Sample virtual file/directory metadata. Inspect err first; stats is absent
   * on error and valid only after a successful callback.
   *
   * @evidence contracts/common.md#principled-implementation Node-shaped metadata adapts the Go bridge's stat consumer.
   * @evidence contracts/common.md#clear-and-simple-design Path lookup projects one stats snapshot through the bridge's err-first callback, without another metadata cache contract.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing paths produce errors rather than synthetic existing-file metadata.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states virtual provenance and error absence under the documentation skill's context guidance.
   */
  stat(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, stats: IFileStats) => void,
  ): void;

  /**
   * Sample path metadata; equivalent to stat because MemFS has no symlinks.
   *
   * @evidence contracts/common.md#principled-implementation Delegating to stat reuses the same metadata projection within the declared virtual capability.
   * @evidence contracts/common.md#clear-and-simple-design The required bridge alias delegates to stat because no supported node can be a symlink.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The no-symlink capability is explicit rather than pretending to resolve arbitrary link targets.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains equivalence and its reason under the documentation skill's rationale guidance.
   */
  lstat(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, stats: IFileStats) => void,
  ): void;

  /**
   * Sample the inode retained by a descriptor, or synthetic pipe-end metadata.
   * Inspect err before using stats, which is absent on error.
   *
   * @evidence contracts/common.md#principled-implementation Open-node identity supplies stats even after the path is removed or replaced.
   * @evidence contracts/common.md#clear-and-simple-design Descriptor stats resolve retained identity directly rather than adding a path-to-descriptor translation layer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor metadata does not silently re-resolve a path to a different inode.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states retained-node and pipe roles under the documentation skill's ownership guidance.
   */
  fstat(
    fd: number,
    callback: (err: NodeJS.ErrnoException | null, stats: IFileStats) => void,
  ): void;

  /**
   * Acknowledge an in-memory flush; MemFS provides no durable backing store.
   *
   * @evidence contracts/common.md#principled-implementation The callback-shaped operation adapts the bridge to an entirely memory-backed store.
   * @evidence contracts/common.md#clear-and-simple-design The required flush callback is explicit while persistence remains outside this memory-only filesystem's capabilities.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Success does not claim disk durability or mutate foreign storage APIs.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states the durability limit under the documentation skill's capability guidance.
   */
  fsync(
    fd: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Remove a file path; open descriptors retain its node until closed.
   *
   * @evidence contracts/common.md#principled-implementation Path removal and open-node lifetime follow separate ownership identities.
   * @evidence contracts/common.md#clear-and-simple-design File unlink owns path removal; directory removal and descriptor close retain their separate named responsibilities.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Directories are rejected rather than orphaning descendants through file removal.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains path versus descriptor lifetime under the documentation skill's ownership guidance.
   */
  unlink(
    path: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Move a file or directory subtree after validating destination compatibility.
   *
   * @evidence contracts/common.md#principled-implementation Tree mutation preserves node identity and moves descendant paths as one operation.
   * @evidence contracts/common.md#clear-and-simple-design A single subtree move owns validation and rebasing instead of composing public delete and recreate operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A rejected destination does not trigger partial moves or type coercion to force success.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states subtree scope and validation ownership under the documentation skill's failure guidance.
   */
  rename(
    from: string,
    to: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Remove an empty virtual directory; root remains owned by the host.
   *
   * @evidence contracts/common.md#principled-implementation Directory removal validates kind and emptiness separately from file unlink.
   * @evidence contracts/common.md#clear-and-simple-design Empty-directory removal has a focused boundary and leaves recursive deletion outside the bridge contract.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nonempty directories are not recursively erased to satisfy a single rmdir request.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains empty-only and root boundaries under the documentation skill's context guidance.
   */
  rmdir(
    path: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Compatibility no-op: virtual file permissions cannot be changed.
   *
   * @evidence contracts/common.md#principled-implementation The bridge signature is retained within the documented fixed-permission capability.
   * @evidence contracts/common.md#clear-and-simple-design The required path-permission verb documents its no-op capability without creating unused permission state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The no-op is explicit rather than claimed as native permission enforcement.
   * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the absent capability under the documentation skill's context guidance.
   */
  chmod(
    path: string,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Descriptor form of the fixed-permission compatibility no-op.
   *
   * @evidence contracts/common.md#principled-implementation The descriptor signature preserves the Go bridge's permission API shape.
   * @evidence contracts/common.md#clear-and-simple-design The required descriptor variant preserves bridge call shape without a separate mutable permission model.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor acceptance does not claim an actual permission change.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states the same capability limit under the documentation skill's clarity guidance.
   */
  fchmod(
    fd: number,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Compatibility no-op: MemFS ownership metadata is synthetic.
   *
   * @evidence contracts/common.md#principled-implementation The Node signature adapts a store without native users or groups.
   * @evidence contracts/common.md#clear-and-simple-design The required path-ownership verb is explicit, with no user/group database this virtual store does not support.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Synthetic ownership is documented rather than inferred from the browser host.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains ownership capability under the documentation skill's context guidance.
   */
  chown(
    path: string,
    uid: number,
    gid: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Descriptor form of the synthetic-ownership compatibility no-op.
   *
   * @evidence contracts/common.md#principled-implementation The descriptor API preserves the Go bridge's ownership operation shape.
   * @evidence contracts/common.md#clear-and-simple-design The descriptor ownership variant shares the same absent capability instead of introducing descriptor-specific ownership state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Success does not claim user/group mutation on an open virtual file.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names the descriptor scope and limit under the documentation skill's clarity guidance.
   */
  fchown(
    fd: number,
    uid: number,
    gid: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Path ownership compatibility no-op; MemFS has no symbolic links.
   *
   * @evidence contracts/common.md#principled-implementation The bridge shape exists despite the store's fixed ownership and absent link capability.
   * @evidence contracts/common.md#clear-and-simple-design The required link-ownership alias makes its limits explicit without adding unsupported symlink machinery.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The no-link limit is explicit rather than simulating a link-specific ownership model.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states both capability boundaries under the documentation skill's context guidance.
   */
  lchown(
    path: string,
    uid: number,
    gid: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Compatibility no-op: timestamps change with mutations, not caller setters.
   *
   * @evidence contracts/common.md#principled-implementation The bridge signature adapts MemFS's mutation-owned timestamp projection.
   * @evidence contracts/common.md#clear-and-simple-design Caller timestamp setting remains an explicit no-op; byte/tree mutations retain ownership of projected timestamps.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller timestamps are not falsely reported as installed metadata.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains the timestamp owner under the documentation skill's rationale guidance.
   */
  utimes(
    path: string,
    atime: number,
    mtime: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Reject hard-link creation with EPERM; aliases are not a MemFS capability.
   *
   * @evidence contracts/common.md#principled-implementation An explicit callback error marks an unsupported bridge operation.
   * @evidence contracts/common.md#clear-and-simple-design One rejection boundary keeps unsupported inode aliasing out of the node tree and descriptor model.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A copied file is not presented as a shared-inode hard link.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names the absent capability and error under the documentation skill's failure guidance.
   */
  link(
    path: string,
    link: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Reject symbolic-link creation with EPERM.
   *
   * @evidence contracts/common.md#principled-implementation The bridge reports its absent symbolic-link capability explicitly.
   * @evidence contracts/common.md#clear-and-simple-design An explicit unsupported operation avoids a second path-resolution model with no supported symlink nodes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Link creation is not approximated by storing target text as an ordinary file.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names the rejection under the documentation skill's failure guidance.
   */
  symlink(
    path: string,
    link: string,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Reject link-target lookup with EINVAL because MemFS has no symbolic links.
   *
   * @evidence contracts/common.md#principled-implementation Explicit unsupported lookup matches the virtual store's declared node kinds.
   * @evidence contracts/common.md#clear-and-simple-design Link-target lookup remains a focused rejection instead of overloading ordinary file text as link state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed path is returned as a fabricated link target.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states the reason and error under the documentation skill's rationale guidance.
   */
  readlink(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, link: string) => void,
  ): void;

  /**
   * Resize a file to a nonnegative integer byte length, zero-filling extensions.
   * A length the engine cannot allocate reports `EFBIG` and changes nothing.
   *
   * @evidence contracts/common.md#principled-implementation Path-based resize operates on the stored node and preserves open-descriptor identity.
   * @evidence contracts/common.md#clear-and-simple-design The path variant resolves a node then uses shared resize semantics rather than composing reads and writes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid lengths and directories remain errors rather than coerced file mutations.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains units, validation and extension under the documentation skill's context guidance.
   */
  truncate(
    path: string,
    length: number,
    callback: (err: NodeJS.ErrnoException | null) => void,
  ): void;

  /**
   * Resize a writable open file without changing its descriptor cursor. A
   * length the engine cannot allocate reports `EFBIG` and changes nothing.
   *
   * @evidence contracts/common.md#principled-implementation Descriptor resize uses retained inode identity and its access grant.
   * @evidence contracts/common.md#clear-and-simple-design Descriptor validation is separate from the shared byte resize; cursor ownership remains with read/write operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Pipe ends and captured streams are not coerced into truncatable files.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states permission and cursor behavior under the documentation skill's ownership guidance.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation Two virtual descriptors expose JavaScript queue endpoints without claiming a Go syscall extension.
   * @evidence contracts/common.md#clear-and-simple-design Two endpoint identities share one queue state; the JavaScript-only capability is kept distinct from native Go pipes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The unreachable Go os.Pipe capability is explicit rather than hidden behind a monkey-patched syscall claim.
   * @evidence contracts/common.md#meaningful-documentation Separate paragraphs explain endpoint shape, Go limits and actual output capture under the documentation skill.
   */
  pipe2(
    flags: number,
    callback: (
      err: NodeJS.ErrnoException | null,
      fds: [number, number],
    ) => void,
  ): void;
}

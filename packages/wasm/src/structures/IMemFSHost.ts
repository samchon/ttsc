import type { IWasmExecFS } from "./IWasmExecFS";

/**
 * Handle returned by `createMemFS`. Provides the `fs` shim to install on
 * `globalThis` plus convenience methods for seeding the virtual filesystem
 * before booting the wasm.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A bridge plus seeding/readback methods keeps virtual filesystem ownership
 *   explicit, with byte and text access separate and missing reads nullable.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Low-level bridge access, convenience seeding/readback and output captures
 *   have distinct members, all sharing one host instead of separate stores.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The same owned filesystem serves compiler input and caller readback;
 *   output captures are distinct from ordinary files and from native host I/O.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains copying, directory creation, missing reads and stream
 *   reset scope, following the documentation skill's ownership/context guidance.
 */
export interface IMemFSHost {
  /** Bridge installed before evaluating wasm_exec.js. */
  fs: IWasmExecFS;

  /**
   * Store copied bytes or UTF-8 text, creating missing parent directories.
   *
   * @evidence contracts/common.md#principled-implementation A dedicated seeding API owns recursive directory creation rather than changing low-level open.
   * @evidence contracts/common.md#clear-and-simple-design One convenience operation owns caller-data copying and parent creation; low-level open keeps its separate contract.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller data is copied into the real backing tree, not an alternate fixture store.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states encoding, copying and parent creation under the documentation skill's context guidance.
   */
  writeFile(path: string, data: string | Uint8Array): void;

  /**
   * Read an owned copy of file bytes; return null for an absent path or directory.
   *
   * @evidence contracts/common.md#principled-implementation Nullable copied bytes distinguish an absent file from an empty file.
   * @evidence contracts/common.md#clear-and-simple-design Byte readback has one nullable result and leaves text conversion to the separate text operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Readback uses the compiler's backing tree rather than reconstructing expected output.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains ownership and null meaning under the documentation skill's absence guidance.
   */
  readFile(path: string): Uint8Array | null;

  /**
   * Decode file bytes as UTF-8; return null for an absent path or directory.
   *
   * Decoding follows `TextDecoder`: a leading byte-order mark is dropped and a
   * malformed sequence becomes U+FFFD. `readFile` returns the exact bytes.
   *
   * @evidence contracts/common.md#principled-implementation Text decoding adapts the same byte store using TextDecoder's UTF-8 behavior.
   * @evidence contracts/common.md#clear-and-simple-design A text view shares the stored file identity and hides decoding/cache details from callers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The text view does not introduce a separately mutable source cache.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names encoding and null meaning under the documentation skill's units/context guidance.
   */
  readFileText(path: string): string | null;

  /**
   * Whether a normalized path names a stored file or directory.
   *
   * @evidence contracts/common.md#principled-implementation A presence query delegates to the same virtual path identity as read and write.
   * @evidence contracts/common.md#clear-and-simple-design A separate presence predicate includes directories without expanding the file-read result shape.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual tree membership determines presence, without an extension-based guess.
   * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes presence from file readability under the documentation skill's clarity guidance.
   */
  exists(path: string): boolean;

  /**
   * Create a directory chain; reject file ancestors before creating any prefix.
   *
   * @evidence contracts/common.md#principled-implementation Recursive seeding is explicit and validates the whole chain before mutation.
   * @evidence contracts/common.md#clear-and-simple-design Parent creation is one named convenience operation instead of being hidden in every bridge path.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A file is not reclassified as a directory to force a requested path to exist.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains rejection effects under the documentation skill's failure guidance.
   */
  mkdirp(path: string): void;

  /** Captured UTF-8 output written to the reserved stdout descriptor. */
  stdout: { buffer: string };

  /** Captured UTF-8 output written to the reserved stderr descriptor. */
  stderr: { buffer: string };

  /**
   * Clear stdout/stderr captures without changing files or open descriptors.
   *
   * @evidence contracts/common.md#principled-implementation Resetting only owned stream buffers makes capture lifetime explicit.
   * @evidence contracts/common.md#clear-and-simple-design Stream reset has one explicit boundary and does not combine filesystem cleanup with capture management.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reset does not erase compiler input or hide failed operations as a filesystem reset.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states the reset boundary under the documentation skill's ownership guidance.
   */
  resetStdio(): void;
}

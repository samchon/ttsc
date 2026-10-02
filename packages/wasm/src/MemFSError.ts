/**
 * Filesystem error with a POSIX error code and numeric `errno`.
 *
 * Matches the shape of `NodeJS.ErrnoException` so Go's `os` package interprets
 * it as a proper `os.PathError` with a numeric error code. Thrown by the MemFS
 * implementation for rejected virtual filesystem operations.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Error fields follow NodeJS.ErrnoException and Go's js/wasm filesystem bridge;
 *   numeric errno values describe that virtual ABI, not the browser host OS.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The Error subclass groups the bridge's machine fields with its message;
 *   one private mapping owns errno translation for every virtual operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   POSIX error identifiers are protocol constants; failed operations remain
 *   errors instead of returning a fake successful callback value.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains the bridge and members' machine-readable roles,
 *   following the documentation skill's concrete context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources MemFSError retains only its own fields and is released with the thrown error.
 * @evidenceExclude contracts/performance.md#efficient-algorithms MemFSError maps a code with one constant switch and chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work MemFSError is an error value and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation MemFSError carries virtual-ABI errno constants and performs no native filesystem or process query.
 */
export class MemFSError extends Error {
  /** POSIX symbolic error, consumed by the Go bridge. */
  public code: string;

  /** Negative Linux-style errno for the virtual filesystem ABI. */
  public errno: number;

  /** Normalized virtual path, when the failing operation identifies one. */
  public path?: string;

  /** Filesystem operation that produced the error. */
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
    case "EBUSY":
      return -16;
    case "EEXIST":
      return -17;
    case "ENOTDIR":
      return -20;
    case "EISDIR":
      return -21;
    case "EINVAL":
      return -22;
    case "EFBIG":
      return -27;
    case "ESPIPE":
      return -29;
    case "EPIPE":
      return -32;
    case "ENOTEMPTY":
      return -39;
    default:
      return -1;
  }
}

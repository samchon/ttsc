/**
 * Filesystem error with a POSIX error code and numeric `errno`.
 *
 * Matches the shape of `NodeJS.ErrnoException` so Go's `os` package interprets
 * it as a proper `os.PathError` with a numeric error code. Thrown by the
 * MemFS implementation when a callback would otherwise pass `null` for an
 * impossible filesystem operation (missing path, type mismatch, …).
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

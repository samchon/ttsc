/**
 * Whether a failed rename of a lock candidate into its own directory lost a
 * race for the destination, the one way both build-lock protocols publish a
 * generation.
 *
 * The candidate was just created in the destination's directory, so that
 * directory is writable, and Windows reports a destination another process
 * holds, or one it is deleting, as `EPERM` or `EACCES`. A holder that releases
 * between the failed rename and a later look at the destination leaves nothing
 * to see, so asking whether the destination exists would take the lost race for
 * a permission failure (samchon/ttsc#1582). The error alone decides.
 *
 * @param error What the rename threw.
 * @returns Whether the caller lost the destination to another process.
 */
export function isContendedCandidateRename(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === "EEXIST" ||
    code === "ENOTEMPTY" ||
    code === "EACCES" ||
    code === "EPERM"
  );
}

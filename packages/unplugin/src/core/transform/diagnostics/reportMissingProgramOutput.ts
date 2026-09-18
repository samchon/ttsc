import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscMissingProgramOutputError } from "../errors/TtscMissingProgramOutputError";

/**
 * Tell the user once that a module was left untransformed, and why.
 *
 * The condition is ordinary and the build continues, but it must never be
 * silent: a file the program does not contain keeps whatever plugin syntax it
 * carries, so a typia `assert<T>()` in it becomes a runtime failure rather than
 * a build failure. One line per file per generation per pass, on the channel
 * the generation's other non-fatal diagnostics already use, so a bundle that
 * reaches many such files does not repeat itself per delivery.
 */
export function reportMissingProgramOutput(
  cached: TtscCachedProjectTransform,
  error: TtscMissingProgramOutputError,
  epoch: number | undefined,
): void {
  const reported = (cached.missingOutputReported ??= new Set<string>());
  if (cached.missingOutputEpoch !== epoch) {
    cached.missingOutputEpoch = epoch;
    reported.clear();
  }
  if (reported.has(error.file)) {
    return;
  }
  reported.add(error.file);
  process.stderr.write(`${error.message}
`);
}

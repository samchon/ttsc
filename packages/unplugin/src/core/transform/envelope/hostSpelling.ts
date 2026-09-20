import path from "node:path";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";

/**
 * The spelling under which a host is handed one of the compiler's inputs
 * (samchon/ttsc#1451).
 *
 * The compiler reports its inputs physically, after every link, while a host
 * names the project by the path it was given: `/var/…` on macOS, where the
 * temporary directory is a link to `/private/var/…`, or a linked workspace
 * anywhere. A build host compares the two lexically. Turbopack refuses a
 * dependency whose physical spelling leaves its lexical root, and webpack's
 * snapshots see the physical file as another file than the one it watches. The
 * adapter therefore speaks the host's spelling at that boundary: an input below
 * the project's physical root returns under the project's own spelling, as the
 * watch broker already translates its events. An input elsewhere, which the
 * host can only know physically, keeps its physical spelling. Every comparison
 * inside the adapter stays by identity.
 */
export function hostSpelling(
  state: TtscEnvelopeDerivation,
  input: string,
): string {
  if (state.projectPhysical === state.projectSpelling) return input;
  const relative = path.relative(state.projectPhysical, input);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return input;
  }
  return path.join(state.projectSpelling, relative);
}

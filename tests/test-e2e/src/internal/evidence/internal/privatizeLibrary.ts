import fs from "node:fs";
import path from "node:path";

import { suiteRoot } from "../../../../../utils/src/evidence/suiteRoot";

/**
 * Replaces a fixture's linked plugin `lib` with a private copy it may damage.
 *
 * `createProject` junctions the workspace build into every fixture so a case
 * always runs the code under test. That is right for every other case and
 * unusable for one that needs to break the toolchain mid-session: a delete
 * through the junction would land on the workspace itself.
 *
 * The link is removed with `unlink`/`rmdir` rather than a recursive remove.
 * Neither call can descend, so the target is unreachable from here by
 * construction rather than by trusting a flag — and if the path is somehow not
 * a link, this refuses to touch it at all.
 */
export const privatizeLibrary = (directory: string): string => {
  const linked: string = path.join(
    directory,
    "node_modules",
    "@ttsc",
    "evidence",
    "lib",
  );
  if (!fs.lstatSync(linked).isSymbolicLink())
    throw new Error(
      `${linked} must be the junction createProject created; refusing to remove a real directory.`,
    );
  try {
    fs.unlinkSync(linked);
  } catch {
    fs.rmdirSync(linked);
  }
  fs.cpSync(
    path.resolve(suiteRoot, "..", "..", "packages", "evidence", "lib"),
    linked,
    {
      recursive: true,
    },
  );
  return linked;
};

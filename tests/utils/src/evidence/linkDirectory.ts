import fs from "node:fs";

/**
 * Junctions a workspace directory into a fixture's `node_modules`.
 *
 * A junction rather than a copy, so a fixture always sees the build currently
 * under test. Existing links are left alone, which makes the call idempotent
 * for a fixture that is rebuilt in place.
 */
export const linkDirectory = (target: string, location: string): void => {
  if (fs.existsSync(location)) return;
  fs.symlinkSync(target, location, "junction");
};

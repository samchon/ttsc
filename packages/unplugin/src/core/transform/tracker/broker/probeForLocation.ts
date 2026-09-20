import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../../filesystem/pathIsWithin";

/**
 * The probe a brokered watch location carries, when the probe root contains it
 * (samchon/ttsc#1453, samchon/ttsc#1454).
 *
 * The location reaches here canonical, after every link, while the probe root
 * is the project root as the adapter names it, which on macOS is a link for
 * every temporary directory (`/var/…` to `/private/var/…`) and a link for any
 * linked workspace. Compared as spelled, the two shared no prefix, so no
 * location was ever probed there: every stream reported ready before its
 * opening probe, heard the writes made just before it as its own, and answered
 * no drain with proof. The root is therefore compared canonical as well. The
 * probe directory keeps the root's own spelling, and the child places it below
 * the root's canonical path by the same relative path.
 *
 * @param directory The location's canonical directory.
 * @param probeRoot The project root as the adapter names it, or `undefined`
 *   when the tracker has no root to probe below.
 * @param probeDirectory The probe directory below `probeRoot`.
 * @param filesystem The filesystem the canonical root is read through.
 */
export function probeForLocation(
  directory: string,
  probeRoot: string | undefined,
  probeDirectory: (root: string) => string,
  filesystem: TtscTransformFilesystemOperations,
): { directory: string; root: string } | undefined {
  if (probeRoot === undefined) return undefined;
  let canonicalRoot: string;
  try {
    canonicalRoot = filesystem.realpath(probeRoot);
  } catch {
    canonicalRoot = path.resolve(probeRoot);
  }
  if (!pathIsWithin(directory, canonicalRoot)) return undefined;
  return { directory: probeDirectory(probeRoot), root: probeRoot };
}

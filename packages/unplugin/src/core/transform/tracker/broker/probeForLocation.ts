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
 * @evidence contracts/common.md#principled-implementation
 *   Canonical root containment determines whether the adapter owns a usable
 *   probe namespace; outside locations remain explicitly unproven.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One containment boundary delegates directory creation to its supplied owner
 *   and preserves that owner's spelling for the child's relative translation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Missing realpath does not invent a foreign project root; the fallback only
 *   compares resolved spelling and actual backend probing still must succeed.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and parameter comments explain alias canonicalization and
 *   probe ownership under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral code compares the supplied filesystem's realpaths and uses
 *   node:path containment instead of assuming macOS aliases share a prefix.
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

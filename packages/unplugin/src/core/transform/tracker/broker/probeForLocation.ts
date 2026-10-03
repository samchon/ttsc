import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../../filesystem/pathIsWithin";

/**
 * The probe a brokered watch location carries, when the probe root contains it
 * (samchon/ttsc#1453, samchon/ttsc#1454).
 *
 * The caller resolves each location when possible, while the project root can
 * retain a linked workspace or temporary-directory spelling. Resolving the
 * root as well permits containment comparison in the same native name domain.
 * A failed root realpath falls back to native absolute spelling and does not
 * establish physical containment. The returned address retains the root's
 * spelling for the child's relative translation; preparing a namespace does
 * not prove that the backend delivered its probe.
 *
 * @param directory The caller's resolved location, with its lexical fallback.
 * @param probeRoot The project root as the adapter names it, or `undefined`
 *   when the tracker has no root to probe below.
 * @param probeDirectory The probe directory below `probeRoot`.
 * @param filesystem The filesystem the canonical root is read through.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Root/location containment determines probe-address eligibility, not usable
 *   backend authority. Canonical observations use the supplied native view;
 *   lexical fallback and subsequent probe delivery still require their owners.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One containment boundary delegates namespace naming/preparation to its
 *   supplied owner and preserves spelling for the child's relative translation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Missing realpath does not invent a foreign project root; the fallback only
 *   compares resolved spelling and actual backend probing still must succeed.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and parameter comments explain alias canonicalization and
 *   probe ownership under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral code compares the supplied filesystem's realpaths and uses
 *   node:path containment instead of assuming macOS aliases share a prefix.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; the probe directory it names is owned by openBrokeredWatch.
 * @evidence contracts/performance.md#efficient-algorithms Root realpath or fallback resolution and containment retain native access/component/text costs. An eligible location also invokes the supplied namespace provider: a warm root lookup differs from cold directory creation, abandoned-probe sweeping and retained-address registration. This eligibility predicate performs no recursive location scan or probe IO itself.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The probe directory is prepared once per project root by openBrokeredWatch; this only decides eligibility.
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

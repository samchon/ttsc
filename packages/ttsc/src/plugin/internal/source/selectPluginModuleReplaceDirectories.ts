import path from "node:path";

import type { IPluginModuleReplaceDirectory } from "./IPluginModuleReplaceDirectory";

/**
 * Select unversioned local replacement targets outside the observed physical
 * module root, preserving Go's module identity and original target spelling.
 *
 * The caller supplies directives parsed by Go and its actual physical-path
 * observer. This selection neither parses go.mod nor proves an observation's
 * native identity. Internal targets, including observed aliases, stay in the
 * module's own source population.
 *
 * @evidence contracts/common.md#principled-implementation Go-local path syntax admits only absolute or dot-relative unversioned targets; observed native containment separates the external population, and module/version sorting preserves the existing record order.
 * @evidence contracts/common.md#clear-and-simple-design Directive filtering, original-root anchoring and physical containment form one internal selection operation; parsing and native observation remain supplied by the owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual parsed directives and observed paths drive selection, not a handwritten go.mod parser or fixture-specific module names.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies parsed-input and physical-observation premises and distinguishes internal source ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Node native path operations anchor relative targets and compare containment; Go dot-relative backslash syntax is accepted only on Windows as before. Supplied physical observations retain their owner's best-effort limitations.
 * @evidence contracts/performance.md#efficient-algorithms All directive entries are visited; selected local targets require native path text work and delegated physical observation, followed by sorting returned module/version text. Observations can traverse ancestors and are not claimed constant.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This selection adds no historical directive or identity cache; the supplied observer and upstream source-key owner retain their existing reuse policies.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Selected records transfer to the caller; no native handle, child, task or historical population is retained by this operation.
 */
export function selectPluginModuleReplaceDirectories(
  root: string,
  replacements: readonly {
    New?: { Path?: string; Version?: string };
    Old?: { Path?: string; Version?: string };
  }[],
  physicalPath: (location: string) => string,
): IPluginModuleReplaceDirectory[] {
  const physicalRoot = physicalPath(root);
  const out: IPluginModuleReplaceDirectory[] = [];
  for (const replacement of replacements) {
    const modulePath = replacement.Old?.Path;
    const spelled = replacement.New?.Path;
    if (
      modulePath === undefined ||
      spelled === undefined ||
      replacement.New?.Version !== undefined ||
      !isFilesystemPath(spelled)
    )
      continue;
    const directory = physicalPath(path.resolve(root, spelled));
    const relative = path.relative(physicalRoot, directory);
    if (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
      continue;
    out.push({
      directory,
      modulePath,
      spelled,
      ...(replacement.Old?.Version === undefined
        ? {}
        : { version: replacement.Old.Version }),
    });
  }
  return out.sort((left, right) =>
    left.modulePath === right.modulePath
      ? (left.version ?? "") < (right.version ?? "")
        ? -1
        : 1
      : left.modulePath < right.modulePath
        ? -1
        : 1,
  );
}

/** Go local target syntax: absolute or dot-relative with native separators. */
function isFilesystemPath(target: string): boolean {
  return (
    path.isAbsolute(target) ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    (process.platform === "win32" &&
      (target.startsWith(".\\") || target.startsWith("..\\")))
  );
}

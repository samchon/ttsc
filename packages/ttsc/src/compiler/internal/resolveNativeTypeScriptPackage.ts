import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Find native TypeScript from a filename used as a Node resolution anchor.
 *
 * The nearest ancestor manifest declaring TypeScript or its npm aliases owns
 * discovery. Its aliases targeting `typescript` precede the ordinary name. A
 * manifest reporting a compiler major below 7 belongs to the JavaScript
 * compiler and is skipped. Missing or nonnumeric version metadata retains the
 * existing path-discovery behavior; executable availability is the caller's
 * responsibility. Alias candidates must report the actual package name
 * `typescript` and a native major. Multiple distinct native alias installs are
 * ambiguous and require an explicit binary. Read and parse errors propagate,
 * except a disappeared manifest is treated as an absent candidate.
 *
 * @evidence contracts/common.md#principled-implementation Project and ancestor dependency maps supply npm aliases by their declared target; Node resolves those arbitrary names from the caller's filename, and installed name/version metadata verifies native identity. Distinct native alias installs are rejected as ambiguous rather than selected by spelling or declaration order.
 * @evidence contracts/common.md#clear-and-simple-design One owner selects manifest metadata for executable resolution and plugin version keys so they cannot choose different package names.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The real package identity and npm alias syntax define discovery; no particular alias, consumer identity or guessed executable is embedded.
 * @evidence contracts/common.md#meaningful-documentation The comment defines anchor semantics, alias precedence, legacy rejection, incomplete metadata behavior and propagated read failures.
 * @evidence contracts/portability.md#os-neutral-implementation createRequire follows native Node package resolution and synchronous filesystem reads without shell commands or path case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms The ancestor walk parses its manifests and visits their declared dependency entries once, then resolves and reads only A distinct aliases plus the ordinary name. Sorting alias names costs O(A log A); Node lookup, realpath and manifest bytes contribute delegated costs. Installed dependency trees are never scanned.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Project installations can change between calls, and this operation owns no invalidation source that would justify a retained result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads retain no open handles and the caller owns the returned metadata.
 */
export function resolveNativeTypeScriptPackage(
  from: string,
): { packageJson: string; manifest: Record<string, unknown> } | undefined {
  const requireFrom = createRequire(from);
  const aliases = new Set<string>();
  for (
    let directory = path.dirname(from);
    ;
    directory = path.dirname(directory)
  ) {
    const project = readManifest(path.join(directory, "package.json"));
    let declaresTypeScript = false;
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]) {
      const dependencies = project?.[field];
      if (dependencies === null || typeof dependencies !== "object") continue;
      declaresTypeScript ||= Object.hasOwn(dependencies, "typescript");
      for (const [name, specifier] of Object.entries(dependencies))
        if (
          name !== "typescript" &&
          typeof specifier === "string" &&
          /^npm:typescript(?:@|$)/.test(specifier)
        )
          aliases.add(name);
    }
    if (declaresTypeScript || aliases.size) break;
    if (path.dirname(directory) === directory) break;
  }
  let selected:
    | { packageJson: string; manifest: Record<string, unknown> }
    | undefined;
  for (const name of [...aliases].sort().concat("typescript")) {
    if (name === "typescript" && selected) return selected;
    let packageJson: string;
    try {
      packageJson = requireFrom.resolve(`${name}/package.json`);
    } catch {
      continue;
    }
    const manifest = readManifest(packageJson);
    if (!manifest) continue;
    const majorText =
      typeof manifest.version === "string"
        ? manifest.version.split(".")[0]!
        : "";
    const major = /^\d+$/.test(majorText) ? Number(majorText) : NaN;
    if (major < 7) continue;
    if (
      name !== "typescript" &&
      (manifest.name !== "typescript" || !Number.isFinite(major))
    )
      continue;
    const candidate = { packageJson, manifest };
    if (name === "typescript") return candidate;
    if (
      selected &&
      fs.realpathSync(selected.packageJson) !== fs.realpathSync(packageJson)
    )
      throw new Error(
        "ttsc: multiple native TypeScript aliases are installed; select one with --binary or TTSC_TSGO_BINARY.",
      );
    selected = candidate;
  }
  return selected;
}

/** Read current manifest bytes, including after Node cached an older path. */
function readManifest(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (
      ["ENOENT", "ENOTDIR"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return undefined;
    throw error;
  }
}

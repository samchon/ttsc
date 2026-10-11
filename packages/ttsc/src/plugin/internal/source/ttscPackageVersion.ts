import fs from "node:fs";
import path from "node:path";

/**
 * The version of this ttsc package, read from its own manifest once per
 * process, or `"0.0.0"` when the manifest cannot be read or names none.
 *
 * WARNING (#1726): a reader that only needs ttsc's own version must take it
 * here, never from `pluginBuildVersions`, which also resolves the project's
 * `typescript` package. A plugin descriptor evaluator opens a record store
 * while its module resolution recorder runs, and on a runtime whose
 * `require.resolve` consults resolve hooks every such lookup became an input of
 * the descriptor: absent `typescript` candidates below the cache root's
 * ancestors, whose proofs the system temporary directory's metadata then
 * withdrew. Reading a file here resolves no module.
 *
 * The host installation is assumed stable for the process lifetime; changing
 * its manifest does not refresh the label.
 *
 * @evidence contracts/common.md#principled-implementation The label is this package's manifest version, the same value plugin keys and record identities have always named; an unreadable manifest yields the documented default instead of a guess.
 * @evidence contracts/common.md#clear-and-simple-design One reader owns the host label; `pluginBuildVersions` composes it with the project's compiler version.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The manifest beside the compiled module is read directly; no module resolution or fixture version stands in for it.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs state the value, the regression that motivates a resolution-free reader and the process-stable premise.
 * @evidence contracts/portability.md#os-neutral-implementation The manifest path is joined with Node path APIs relative to this module, without separator or case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms The first call reads and parses one small manifest; later calls return the retained label.
 * @evidence contracts/performance.md#reuse-equivalent-work Every caller in the process shares one reading of an installation assumed stable for that process.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One label string is retained for the process lifetime; the synchronous read leaves no descriptor open.
 */
export function ttscPackageVersion(): string {
  if (version !== undefined) return version;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "..", "..", "..", "package.json"),
        "utf8",
      ),
    ) as { version?: string };
    version = manifest.version ?? "0.0.0";
  } catch {
    version = "0.0.0";
  }
  return version;
}

let version: string | undefined;

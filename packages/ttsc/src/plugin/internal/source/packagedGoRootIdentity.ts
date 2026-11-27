import fs from "node:fs";
import path from "node:path";

import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";

/**
 * Identify the Go root selected from an installed ttsc platform package. The
 * caller supplies the manifest from package resolution and the root Go
 * reported. The publisher gives the installed SDK its package version. A
 * manifest that does not describe this SDK leaves content identity to the
 * ordinary SDK walker.
 *
 * This relies on installed packages remaining intact until replacement. Use a
 * caller-supplied Go executable or GOROOT to track in-place SDK edits.
 *
 * @evidence contracts/common.md#principled-implementation The reported SDK must occupy the resolved package's SDK path, and the manifest must name this platform and a version. The version pins the published tree under the stated installation contract; the root, manifest, SDK version and go.env remain observed dependencies.
 * @evidence contracts/common.md#clear-and-simple-design Package resolution supplies the candidate and the hasher owns the mutable-SDK fallback; this helper recognizes and reads the installed SDK identity only.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A bare path or VERSION file is insufficient. A different root, unreadable manifest or wrong package name leaves the work to content hashing.
 * @evidence contracts/common.md#meaningful-documentation The prose states the input provenance, the installed-package premise and the way to track editable SDKs.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and realpath compare the reported root with its layout after link resolution; Node reads the observed files and the Go SDK uses the same directory names across targets.
 * @evidence contracts/performance.md#efficient-algorithms A fixed number of native path and metadata lookups and two small file reads replace the SDK tree walk. JSON and VERSION processing cost their input bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Equivalent package name and version plus VERSION bytes contribute equal identities across install paths. The enclosing witnessed answer reuses the reading only while the observed metadata holds.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns the witness and all native reads are synchronous. The helper retains no state or handle.
 */
export function packagedGoRootIdentity(
  packageManifest: string,
  goRoot: string,
  filesystem: SourceBuildFilesystemOperations,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
): string | undefined {
  const expected = path.join(path.dirname(packageManifest), "bin", "go");
  const versionFile = path.join(goRoot, "VERSION");
  try {
    if (fs.realpathSync.native(goRoot) !== expected) return undefined;
    PluginBuildEnvironmentWitness.add(witness, goRoot);
    const manifestStat = fs.statSync(packageManifest, {
      bigint: true,
      throwIfNoEntry: false,
    });
    const versionStat = fs.statSync(versionFile, {
      bigint: true,
      throwIfNoEntry: false,
    });
    PluginBuildEnvironmentWitness.add(witness, packageManifest, manifestStat);
    PluginBuildEnvironmentWitness.add(witness, versionFile, versionStat);
    if (!manifestStat?.isFile() || !versionStat?.isFile()) return undefined;
    const { name, version } = JSON.parse(
      filesystem.readFile(packageManifest).toString("utf8"),
    );
    if (
      name !== `@ttsc/${process.platform}-${process.arch}` ||
      typeof version !== "string" ||
      version.length === 0
    )
      return undefined;
    const sdkVersion = filesystem.readFile(versionFile).toString("utf8");
    if (sdkVersion.trim() === "") return undefined;
    PluginBuildEnvironmentWitness.add(witness, path.join(goRoot, "go.env"));
    return `packaged:${JSON.stringify([name, version, sdkVersion])}`;
  } catch {
    PluginBuildEnvironmentWitness.add(witness, packageManifest);
    PluginBuildEnvironmentWitness.add(witness, versionFile);
    return undefined;
  }
}

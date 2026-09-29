import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "./GoToolResolution";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { pluginModuleReplaceDirectories } from "./pluginModuleReplaceDirectories";
import { pluginSourceDigest } from "./pluginSourceDigest";

/**
 * Compute a deterministic SHA-256 cache key for a plugin build.
 *
 * The key covers ttsc/tsgo versions, platform, entry package, Go compiler
 * identity, Go build environment variables, overlay module sources, plugin
 * source files, the local directories outside the module that its `go.mod`
 * replaces modules with (`pluginModuleReplaceDirectories`), and contributor
 * source files. Contributors are sorted by name so declaration order does not
 * affect the key.
 *
 * Each source directory enters the key as its digest (`pluginSourceDigest`),
 * which the transform envelope reports, with the environment below, as the
 * state of each directory a plugin supplied (`pluginSourceState`), so what a
 * consumer proves is exactly what the binary was keyed on (samchon/ttsc#1487).
 * `sourceDigests` carries the digests one load already took: every build of the
 * load keys on one reading of each directory, and the load reports those
 * readings. The environment enters through `hashPluginBuildEnvironment`, the
 * rule that reported state takes it from too, and `environmentDigests` carries
 * the digest of each build directory's, so the load reports it without a second
 * `go env` run (samchon/ttsc#1493).
 *
 * The `ttsc cache` CLI and plugin build pipeline share this key computation.
 *
 * @evidence contracts/common.md#principled-implementation The key frames versions, platform, entry, environment and labeled source digests; sorted overlays/contributors remove irrelevant order while local replacements remain actual compiler inputs.
 * @evidence contracts/common.md#clear-and-simple-design Source identity and toolchain serialization are delegated to their shared owners; optional maps carry one load's readings instead of adding an independent cache policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts All contributors and local module replacements participate; filesystem injection is an explicit byte-reading boundary rather than foreign monkey patching.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain input coverage and the provenance of reported digests; documented optional output maps have blank separation between members.
 * @evidence contracts/portability.md#os-neutral-implementation Native roots are resolved with Node path APIs and executable resolution; platform/architecture intentionally distinguish incompatible binary artifacts.
 * @evidence contracts/performance.md#efficient-algorithms Source files are streamed into per-directory hashes once; ordering costs O(C log C + O log O) for contributors/overlays while toolchain metadata and changed bytes dominate environment work.
 * @evidence contracts/performance.md#reuse-equivalent-work Caller-owned sourceDigests share one absolute-directory reading across contributor, overlay and plugin roles; environmentDigests lets consumers report the exact fresh reading without a second probe.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Output maps belong to the enclosing load; this operation retains no handles or process-wide records itself.
 */
export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  env?: NodeJS.ProcessEnv;

  /**
   * Digests of the environment each build directory is keyed on
   * (`pluginBuildEnvironment`), filled with this build's, so the load reports
   * its plugin sources' states without reading the environment again.
   */
  environmentDigests?: Map<string, string>;

  /**
   * Receives the metadata of every toolchain path the environment was read from
   * (`PluginBuildEnvironmentWitness`), so the build can prove the toolchain it
   * ran is still the one this key read.
   */
  environmentWitness?: PluginBuildEnvironmentWitness.Record;

  filesystem?: Partial<SourceBuildFilesystemOperations>;
  goBinary?: string;
  overlayDirs?: readonly string[];

  /**
   * Digests of the source directories this load already read, by absolute path.
   * Read through, and filled with every directory this key covers.
   */
  sourceDigests?: Map<string, string>;

  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const env = inputs.env ?? process.env;
  const filesystem: SourceBuildFilesystemOperations = {
    readFile:
      inputs.filesystem?.readFile ?? DEFAULT_SOURCE_BUILD_FILESYSTEM.readFile,
  };
  const goBinary =
    inputs.goBinary === undefined
      ? undefined
      : GoToolResolution.resolveGoToolForBuild(
          inputs.goBinary,
          env,
          inputs.dir,
        );
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(["ttsc", inputs.ttscVersion]));
  hash.update(JSON.stringify(["tsgo", inputs.tsgoVersion]));
  hash.update(JSON.stringify(["platform", process.platform, process.arch]));
  hash.update(JSON.stringify(["entry", inputs.entry]));
  // The same framed values enter the key and the environment-only digest,
  // which pluginBuildEnvironment reads for this directory.
  const environment = crypto.createHash("sha256");
  hashPluginBuildEnvironment(
    {
      update: (data: string) => {
        hash.update(data);
        environment.update(data);
      },
    },
    goBinary,
    inputs.dir,
    env,
    filesystem,
    inputs.environmentWitness,
  );
  inputs.environmentDigests?.set(
    path.resolve(inputs.dir),
    environment.digest("hex"),
  );
  hashSourceDirectory(hash, "plugin", inputs.dir, inputs.sourceDigests);
  // A `replace` target outside the module is compiled in place, so it is as
  // much a source of the binary as the module itself (samchon/ttsc#1506). A
  // module without one keys exactly as before.
  for (const replacement of pluginModuleReplaceDirectories(
    inputs.dir,
    env,
    goBinary,
  )) {
    hashSourceDirectory(
      hash,
      `replace:${replacement.modulePath}${
        replacement.version === undefined ? "" : `@${replacement.version}`
      }`,
      replacement.directory,
      inputs.sourceDigests,
    );
  }
  for (const [index, dir] of [...(inputs.overlayDirs ?? [])].sort().entries()) {
    hashSourceDirectory(hash, `overlay:${index}`, dir, inputs.sourceDigests);
  }
  // Hash contributors in sorted-by-name order so two consumers with the
  // same logical set produce the same key regardless of declaration order
  // in the host's plugin descriptor.
  const sortedContributors = [...(inputs.contributors ?? [])].sort((a, b) =>
    a.name === b.name ? 0 : a.name < b.name ? -1 : 1,
  );
  for (const contributor of sortedContributors) {
    hashSourceDirectory(
      hash,
      `contributor:${contributor.name}`,
      contributor.source,
      inputs.sourceDigests,
    );
  }
  return hash.digest("hex").slice(0, 32);
}

const DEFAULT_SOURCE_BUILD_FILESYSTEM: SourceBuildFilesystemOperations =
  Object.freeze({
    readFile: (location: string) => fs.readFileSync(location),
  });

function hashSourceDirectory(
  hash: crypto.Hash,
  label: string,
  root: string,
  digests: Map<string, string> | undefined,
): void {
  const directory = path.resolve(root);
  let digest = digests?.get(directory);
  if (digest === undefined) {
    digest = pluginSourceDigest(directory);
    digests?.set(directory, digest);
  }
  hash.update(JSON.stringify(["dir", label, digest]));
}

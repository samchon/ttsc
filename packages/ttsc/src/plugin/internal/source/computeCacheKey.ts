import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "./GoToolResolution";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { pluginSourceDigest } from "./pluginSourceDigest";

/**
 * Compute a deterministic SHA-256 cache key for a plugin build.
 *
 * The key covers every input that can produce a different binary: ttsc/tsgo
 * versions, platform, entry package, Go compiler identity, Go build environment
 * variables, overlay module sources, plugin source files, and contributor
 * source files. Contributors are sorted by name so declaration order does not
 * affect the key.
 *
 * Each source directory enters the key as its digest (`pluginSourceDigest`),
 * the state the transform envelope reports for each directory a plugin
 * supplied, so what a consumer proves is exactly what the binary was keyed on
 * (samchon/ttsc#1487). `sourceDigests` carries the digests one load already
 * took: every build of the load keys on one reading of each directory, and the
 * load reports those readings. The environment enters through
 * `hashPluginBuildEnvironment`, the rule that reported state takes it from too
 * (samchon/ttsc#1493).
 *
 * Exposed for testing and for the `ttsc cache` CLI command.
 */
export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  env?: NodeJS.ProcessEnv;
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
  hash.update(`ttsc=${inputs.ttscVersion}\n`);
  hash.update(`tsgo=${inputs.tsgoVersion}\n`);
  hash.update(`platform=${process.platform}/${process.arch}\n`);
  hash.update(`entry=${inputs.entry}\n`);
  hashPluginBuildEnvironment(hash, goBinary, inputs.dir, env, filesystem);
  hashSourceDirectory(hash, "plugin", inputs.dir, inputs.sourceDigests);
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
  hash.update(`dir=${label}
${digest}
`);
}

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
 * Compute a 32-character lowercase key from a plugin build's SHA-256 digest.
 *
 * The key covers ttsc/tsgo versions, platform, entry package, Go compiler
 * identity, Go build environment variables, overlay module sources, plugin
 * source files, the local directories outside the module that its `go.mod`
 * replaces modules with (`pluginModuleReplaceDirectories`), and contributor
 * source files. An optional required package-ownership population also frames
 * the key, separating binaries admitted by the matching cold producer from
 * legacy artifacts; requests without that authority retain their existing key.
 * Contributors are sorted by name; unique names remove input
 * order dependence, while equal-name rows retain the sort's input order.
 *
 * Each source directory enters the key as its digest (`pluginSourceDigest`),
 * which the transform envelope reports, with the environment below, as the
 * state of directories selected by the loader's report policy. Supplied memo
 * values are trusted producer readings, not revalidated content observations.
 * `sourceDigests` carries the digests one load already took: every build of the
 * load keys on one reading of each directory, and the load reports those
 * readings. The environment enters through `hashPluginBuildEnvironment`, the
 * rule that reported state takes it from too, and `environmentDigests` carries
 * the digest of each build directory's, so the load reports it without a second
 * `go env` run.
 *
 * The `ttsc cache` CLI and plugin build pipeline share this key computation.
 *
 * @evidence contracts/common.md#principled-implementation The key frames versions, platform, entry, environment and labeled source digests; sorted overlays/contributors and required package ownership remove irrelevant order while local replacements remain actual compiler inputs.
 * @evidence contracts/common.md#clear-and-simple-design Source identity and toolchain serialization are delegated to their shared owners; optional maps carry one load's readings instead of adding an independent cache policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts All contributors and local module replacements participate; filesystem injection is an explicit byte-reading boundary rather than foreign monkey patching.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain input coverage and the provenance of reported digests; documented optional output maps have blank separation between members.
 * @evidence contracts/portability.md#os-neutral-implementation Native roots are resolved with Node path APIs and executable resolution; platform/architecture intentionally distinguish incompatible binary artifacts.
 * @evidence contracts/performance.md#efficient-algorithms Source digest misses enumerate/sort paths and read individual files in full, not bounded streaming chunks. Overlay/contributor ordering compares path/name text; replacement discovery can read a manifest/run Go and native containment queries. Toolchain/env hashing delegates native metadata/probes/full bytes and memo checks without an unmeasured dominant-cost ranking; JSON framing processes all version/entry/label/digest text.
 * @evidence contracts/performance.md#reuse-equivalent-work Caller-owned sourceDigests share supplied absolute-directory readings across roles without independently verifying their provenance/currentness. EnvironmentDigests receives this call's selected environment identity so reporting can avoid another probe; it does not skip environment hashing. Reuse inherits the selected population and metadata/producer premises.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Output maps belong to the enclosing load; this operation retains no handles or process-wide records itself.
 */
export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  env?: NodeJS.ProcessEnv;

  /** Required package ownership, admitted by the matching cold producer. */
  packageOwnership?: readonly { entry: string; kind: "executable" | "linked" }[];

  /**
   * Digests of the environment each build directory is keyed on
   * (`pluginBuildEnvironment`), filled with this build's, so the load reports
   * its plugin sources' states without reading the environment again.
   */
  environmentDigests?: Map<string, string>;

  /**
   * Receives selected native toolchain dependencies from the environment reader
   * for later comparison under its metadata-distinguishability premise; it is
   * not detection of arbitrary unreported tool/launcher reads.
   */
  environmentWitness?: PluginBuildEnvironmentWitness.Record;

  /** Byte adapter for delegated SDK identity; plugin source digests use fs. */
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
  if (inputs.packageOwnership !== undefined)
    hash.update(JSON.stringify(["package-ownership", 1,
      [...inputs.packageOwnership].sort((left, right) =>
        left.entry < right.entry ? -1 : left.entry > right.entry ? 1 :
          left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0),
    ]));
  // Private materialization changes native package working directories. Keep
  // binaries produced by the former absolute-ancestry layout out of this
  // layout's cache admissions, including callers with no SDK overlays.
  hash.update(JSON.stringify(["external-source-layout", 1]));
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
  // Local replacement targets outside the module supply separately keyed
  // sources. buildSourcePlugin snapshots and proves their copies before
  // redirecting the Go replacement directives to the scratch tree.
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

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "./GoToolResolution";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "./PluginContentIdentities";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import type { SourcePluginWorkspace } from "./SourcePluginWorkspace";
import { hashPluginBuildEnvironment } from "./hashPluginBuildEnvironment";
import { pluginModuleReplaceDirectories } from "./pluginModuleReplaceDirectories";

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
 * Contributors are sorted by name; unique names remove input order dependence,
 * while equal-name rows retain the sort's input order.
 *
 * Each source directory enters the key as its digest (`pluginSourceDigest`),
 * which the transform envelope reports, with the environment below, as the
 * state of directories selected by the loader's report policy. Supplied memo
 * values are trusted producer readings, not revalidated content observations.
 * `sourceDigests` carries the digests one load already took: every build of the
 * load keys on one reading of each directory, and the load reports those
 * readings. The environment enters as the digest of
 * `hashPluginBuildEnvironment`, the rule that reported state takes it from too,
 * and `environmentDigests` carries the digest of each build directory's, so the
 * load reports it without a second `go env` run. With `environmentWitnesses`, a
 * reading the load already took for the same directory, such as package
 * selection's, keys the build too, and its witness joins the build's.
 *
 * The `ttsc cache` CLI and plugin build pipeline share this key computation.
 *
 * @evidence contracts/common.md#principled-implementation The key frames versions, platform, entry, environment and labeled source digests; sorted overlays/contributors and required package ownership remove irrelevant order while local replacements remain actual compiler inputs.
 * @evidence contracts/common.md#clear-and-simple-design Source identity and toolchain serialization are delegated to their shared owners; optional maps carry one load's readings instead of adding an independent cache policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts All contributors and local module replacements participate; filesystem injection is an explicit byte-reading boundary rather than foreign monkey patching.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain input coverage and the provenance of reported digests; documented optional output maps have blank separation between members.
 * @evidence contracts/portability.md#os-neutral-implementation Native roots are resolved with Node path APIs and executable resolution; platform/architecture intentionally distinguish incompatible binary artifacts.
 * @evidence contracts/performance.md#efficient-algorithms Source digest misses enumerate/sort paths and read individual files in full, not bounded streaming chunks. Overlay/contributor ordering compares path/name text; replacement discovery can read a manifest/run Go and native containment queries. Toolchain/env hashing delegates native metadata/probes/full bytes and memo checks without an unmeasured dominant-cost ranking; JSON framing processes all version/entry/label/digest text.
 * @evidence contracts/performance.md#reuse-equivalent-work Caller-owned sourceDigests share supplied absolute-directory readings across roles without independently verifying their provenance/currentness. A supplied record store lets a new process reuse a directory, SDK or executable digest only while its separable metadata signature matches the recorded one (#1722), so unchanged inputs are not re-read per process. EnvironmentDigests receives this call's selected environment identity so reporting can avoid another probe. A same-directory reading of the same load, with its witness, replaces a second environment probe; the witness then joins this build's, which the build compares after it ran, and a non-default byte adapter never shares. Reuse inherits the selected population and metadata/producer premises.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Output maps belong to the enclosing load; this operation retains no handles or process-wide records itself.
 */
export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  env?: NodeJS.ProcessEnv;

  /** Required package ownership, admitted by the matching cold producer. */
  packageOwnership?: readonly {
    entry: string;
    kind: "executable" | "linked";
  }[];

  /**
   * Digests of the environment each build directory is keyed on
   * (`pluginBuildEnvironment`), filled with this build's, so the load reports
   * its plugin sources' states without reading the environment again.
   */
  environmentDigests?: Map<string, string>;

  /**
   * Witness of each reading in `environmentDigests` this load took, by
   * directory. A digest with its witness stands for this call's own reading:
   * the key takes it instead of running Go again and copies the witness into
   * `environmentWitness`. Filled with this call's reading when it takes one.
   */
  environmentWitnesses?: Map<string, PluginBuildEnvironmentWitness.Record>;

  /**
   * Receives selected native toolchain dependencies from the environment reader
   * for later comparison under its metadata-distinguishability premise; it is
   * not detection of arbitrary unreported tool/launcher reads.
   */
  environmentWitness?: PluginBuildEnvironmentWitness.Record;

  /** Byte adapter for delegated SDK identity; plugin source digests use fs. */
  filesystem?: Partial<SourceBuildFilesystemOperations>;
  goBinary?: string;
  goModReader?: SourcePluginWorkspace.GoModReader;

  /**
   * Record store that proves unchanged sources, overlays, contributors, GOROOT
   * and executables from metadata in a new process (#1722). Without it every
   * process reads their bytes.
   */
  identities?: PluginContentIdentities.Store;

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
    hash.update(
      JSON.stringify([
        "package-ownership",
        1,
        [...inputs.packageOwnership].sort((left, right) =>
          left.entry < right.entry
            ? -1
            : left.entry > right.entry
              ? 1
              : left.kind < right.kind
                ? -1
                : left.kind > right.kind
                  ? 1
                  : 0,
        ),
      ]),
    );
  // Private materialization changes native package working directories. Keep
  // binaries produced by the former absolute-ancestry layout out of this
  // layout's cache admissions, including callers with no SDK overlays.
  hash.update(JSON.stringify(["external-source-layout", 1]));
  const overlays = [...(inputs.overlayDirs ?? [])].sort();
  // Hash contributors in sorted-by-name order so two consumers with the
  // same logical set produce the same key regardless of declaration order
  // in the host's plugin descriptor.
  const sortedContributors = [...(inputs.contributors ?? [])].sort((a, b) =>
    a.name === b.name ? 0 : a.name < b.name ? -1 : 1,
  );
  // A store whose root lies inside a directory this key hashes would write
  // records into that source, so such a store proves nothing here. The build
  // rejects that cache placement (`SourcePluginAdmission`) once every source
  // is known; replacement targets narrow the store below, before their own
  // digests, since only Go's reading of the manifest names them.
  let identities = PluginContentIdentities.outside(inputs.identities, [
    inputs.dir,
    ...overlays,
    ...sortedContributors.map((contributor) => contributor.source),
  ]);
  // The key frames the environment digest pluginBuildEnvironment reports for
  // this directory. WARNING (#1721): package selection reads that environment
  // first in the same load; reading it again here doubled `go env` and
  // `go version` per load. A reading taken through another byte adapter is
  // not this one's, so only the default adapter shares it.
  const environmentDirectory = path.resolve(inputs.dir);
  const sharedDigest =
    inputs.filesystem === undefined
      ? inputs.environmentDigests?.get(environmentDirectory)
      : undefined;
  const sharedWitness =
    sharedDigest === undefined
      ? undefined
      : inputs.environmentWitnesses?.get(environmentDirectory);
  let environment: string;
  if (sharedDigest !== undefined && sharedWitness !== undefined) {
    // The build compares this witness after it ran, exactly as it would its
    // own reading's, so a toolchain change since the reading still refuses.
    for (const [file, state] of sharedWitness)
      if (!inputs.environmentWitness?.has(file))
        inputs.environmentWitness?.set(file, state);
    environment = sharedDigest;
  } else {
    const witness =
      inputs.environmentWitness ??
      (inputs.environmentWitnesses === undefined ? undefined : new Map());
    const reading = crypto.createHash("sha256");
    hashPluginBuildEnvironment(
      reading,
      goBinary,
      inputs.dir,
      env,
      filesystem,
      witness,
      identities,
    );
    environment = reading.digest("hex");
    inputs.environmentDigests?.set(environmentDirectory, environment);
    if (inputs.filesystem === undefined && witness !== undefined)
      inputs.environmentWitnesses?.set(environmentDirectory, new Map(witness));
  }
  hash.update(JSON.stringify(["environment", environment]));
  const directory = (label: string, root: string): void =>
    hashSourceDirectory(hash, label, root, inputs.sourceDigests, identities);
  directory("plugin", inputs.dir);
  // Local replacement targets outside the module supply separately keyed
  // sources. buildSourcePlugin snapshots and proves their copies before
  // redirecting the Go replacement directives to the scratch tree. Go reads the
  // manifest after the plugin's digest, so an edit made meanwhile lands between
  // that digest and the build's copy, which `requireKeyedSource` refuses.
  const replacements = pluginModuleReplaceDirectories(
    inputs.dir,
    env,
    goBinary,
    inputs.goModReader,
  );
  identities = PluginContentIdentities.outside(
    identities,
    replacements.map((replacement) => replacement.directory),
  );
  for (const replacement of replacements) {
    directory(
      `replace:${replacement.modulePath}${
        replacement.version === undefined ? "" : `@${replacement.version}`
      }`,
      replacement.directory,
    );
  }
  for (const [index, dir] of overlays.entries()) {
    directory(`overlay:${index}`, dir);
  }
  for (const contributor of sortedContributors) {
    directory(`contributor:${contributor.name}`, contributor.source);
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
  identities: PluginContentIdentities.Store | undefined,
): void {
  const directory = path.resolve(root);
  let digest = digests?.get(directory);
  if (digest === undefined) {
    // WARNING (#1722): the load-scoped map above ends with the process. Only the
    // record store spares a new process from reading every source byte again.
    digest = PluginContentIdentities.sourceDirectory(identities, directory);
    digests?.set(directory, digest);
  }
  hash.update(JSON.stringify(["dir", label, digest]));
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type { ITtscStripConfig } from "./structures/ITtscStripConfig";

/**
 * Register the native strip transform and record its config-discovery inputs.
 *
 * The host supplies this module's absolute directory in `context.dirname`.
 * Config discovery starts at `pluginConfigDir`, or the tsconfig directory when
 * that anchor is absent. A nonblank string `plugin.configFile` records only its
 * resolved path; otherwise discovery records all seven candidates at each
 * ancestor through the first directory containing a file, or the volume root.
 *
 * Unknown plugin-entry keys throw so stale inline stripping options cannot
 * silently select defaults. The Go driver validates configFile, rejects
 * ambiguous discoveries and evaluates the selected config. This factory only
 * fingerprints candidate state; it neither evaluates config nor rewrites ASTs.
 *
 * Each evaluation probes seven candidates per visited directory and hashes the
 * bytes of readable files. An explicit path limits discovery to one candidate.
 * Input arrays and maps are fresh per call; the factory retains no watchers,
 * subprocesses or cross-call cache. Host reuse must validate the returned
 * candidate observations, including absent files and physical targets. These
 * observations describe descriptor evaluation, not complete native dependency
 * analysis. This migration makes no measured performance improvement claim.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   The factory uses the host's supported default-export registration,
 *   node:path/fs/crypto APIs and the maintained banner and paths packages'
 *   TypeScript build convention. The package name, stage, accepted entry keys
 *   and candidate filenames are native contract values, not fixture answers.
 *   Discovery reads owned observations without foreign mutation or test-only
 *   branches.
 *
 *   The former handwritten CommonJS entry was outside TypeScript selection
 *   and its handwritten export-assignment declarations prevented complete
 *   analysis. TypeScript source and compiler-generated declarations replace
 *   both paths without a compatibility adapter. Descriptor parity covers
 *   explicit, missing, directory, ambiguous and linked candidates and
 *   rejected entry keys; the existing strip suite covers native registration
 *   and removal. Compiler-emitted CommonJS is supported build output. Shared
 *   native config evaluation still uses a private resolver patch and remains
 *   an unresolved owning-layer concern; this factory neither performs nor
 *   certifies that evaluation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   node:path resolves explicit paths, host anchors, ancestors and the
 *   sibling driver on Windows and POSIX. The walk terminates when dirname
 *   reaches the same volume root; filesystem APIs fingerprint bytes,
 *   directory markers and physical targets without interpreting separators or
 *   case manually. Missing or unreadable candidates yield null observations.
 *   This factory spawns no process and reads no ambient __dirname.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The inspected entry validator rejects unknown inline options. Discovery
 *   records absent candidates, readable file bytes, directory markers and
 *   physical targets through the first containing ancestor; explicit nonblank
 *   configFile records one path. The native loader separately validates and
 *   evaluates configuration. A 13-case descriptor comparison and six existing
 *   strip cases passed after migration. The shared script-evaluation recorder
 *   has an unresolved private-loader mutation documented in
 *   .wiki/evidence-adoption/findings.md; this descriptor does not repair it.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc separates host anchoring, candidate observation, validation
 *   and native ownership into paragraphs, including error and absent-anchor
 *   behavior. Context and result comments explain the consuming watch and
 *   reuse protocol. The documentation skill's clear prose, paragraph and
 *   rationale guidance also governs the updated maintainer walkthrough, whose
 *   source and build instructions describe generated declarations.
 *
 */
export default function createTtscStrip(
  context: TtscStripFactoryContext,
): TtscStripDescriptor {
  const plugin =
    context && typeof context === "object" && context.plugin != null
      ? context.plugin
      : {};
  for (const key of Object.keys(plugin)) {
    if (!ALLOWED_TSCONFIG_KEYS.has(key)) {
      throw new Error(
        `@ttsc/strip: tsconfig plugin entry contains unsupported key ${JSON.stringify(key)}; ` +
          `strip configuration must be supplied via a strip.config.* file ` +
          `(use the "configFile" key to point at a custom path)`,
      );
    }
  }
  const configInputs = stripConfigInputs(context);
  return {
    hostInputHashes: configInputs.hashes,
    hostInputRealpaths: configInputs.realpaths,
    hostInputs: configInputs.inputs,
    name: "@ttsc/strip",
    source: path.resolve(context.dirname, "..", "driver"),
    stage: "transform",
  };
}

/** Host fields consumed while constructing this descriptor. */
type TtscStripFactoryContext = {
  /** Absolute directory of the loaded descriptor module. */
  dirname: string;
  /** Discovery anchor, including projects with generated wrapper tsconfigs. */
  pluginConfigDir?: string;
  /** Original plugin entry; unknown keys are rejected rather than ignored. */
  plugin?: Record<string, unknown>;
  /** Absolute tsconfig path, whose directory supplies the default anchor. */
  tsconfig: string;
};

/** Candidate observations consumed by host watch and descriptor reuse. */
type TtscStripInputs = {
  /** Content digest, directory marker digest, or null for a failed read. */
  hashes: Record<string, string | null>;
  /** Absolute candidate paths, including absent and directory candidates. */
  inputs: string[];
  /** Physical target of each candidate, or null when resolution fails. */
  realpaths: Record<string, string | null>;
};

/** Registration of native source and the descriptor's observed inputs. */
type TtscStripDescriptor = {
  /** Evaluation-time fingerprints used to validate descriptor reuse. */
  hostInputHashes: TtscStripInputs["hashes"];
  /** Physical targets that detect candidate symlink or junction changes. */
  hostInputRealpaths: TtscStripInputs["realpaths"];
  /** Candidate paths the host watches, including negative observations. */
  hostInputs: TtscStripInputs["inputs"];
  /** Package identity used in plugin registration and diagnostics. */
  name: string;
  /** Absolute Go driver directory compiled and linked by the host. */
  source: string;
  /** Source transformation runs before normal JavaScript emit. */
  stage: "transform";
};

// Accept only host-owned entry keys and the explicit package config path.
const ALLOWED_TSCONFIG_KEYS = new Set([
  "configFile",
  "enabled",
  "name",
  "stage",
  "transform",
]);

const STRIP_CONFIG_FILENAMES = [
  "strip.config.ts",
  "strip.config.mts",
  "strip.config.cts",
  "strip.config.js",
  "strip.config.mjs",
  "strip.config.cjs",
  "strip.config.json",
];

function stripConfigInputs(context: TtscStripFactoryContext): TtscStripInputs {
  const configFile = context.plugin?.configFile;
  const base = path.resolve(
    context.pluginConfigDir ?? path.dirname(context.tsconfig),
  );
  if (typeof configFile === "string" && configFile.trim() !== "") {
    const file = path.isAbsolute(configFile)
      ? path.resolve(configFile)
      : path.resolve(base, configFile);
    return {
      hashes: { [file]: hostInputHash(file) },
      inputs: [file],
      realpaths: { [file]: hostInputRealpath(file) },
    };
  }
  const inputs: string[] = [];
  const hashes: Record<string, string | null> = {};
  const realpaths: Record<string, string | null> = {};
  for (let directory = base; ; directory = path.dirname(directory)) {
    const candidates = STRIP_CONFIG_FILENAMES.map((name) =>
      path.join(directory, name),
    );
    inputs.push(...candidates);
    for (const candidate of candidates) {
      hashes[candidate] = hostInputHash(candidate);
      realpaths[candidate] = hostInputRealpath(candidate);
    }
    if (candidates.some(configCandidateExists)) break;
    const parent = path.dirname(directory);
    if (parent === directory) break;
  }
  return { hashes, inputs, realpaths };
}

function hostInputRealpath(file: string): string | null {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}

/** Hash the exact candidate state observed before discovery selects a file. */
function hostInputHash(file: string): string | null {
  try {
    if (fs.statSync(file).isDirectory()) {
      return crypto
        .createHash("sha256")
        .update("ttsc:host-input:directory\0")
        .digest("hex");
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
  } catch {
    return null;
  }
}

/** Match the native discovery rule: a directory is never a config file. */
function configCandidateExists(file: string): boolean {
  try {
    return !fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}

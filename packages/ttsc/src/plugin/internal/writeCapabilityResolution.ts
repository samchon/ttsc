import fs from "node:fs";
import path from "node:path";

import { CapabilityResolutionFormat } from "./CapabilityResolutionFormat";
import type { ITtscCapabilityPluginSource } from "./ITtscCapabilityPluginSource";
import type { ITtscCapabilityResolutionEntry } from "./ITtscCapabilityResolutionEntry";
import type { ITtscCapabilityResolutionPlugin } from "./ITtscCapabilityResolutionPlugin";
import { pluginSourceDigest } from "./source/pluginSourceDigest";
import { pluginSourceFilesSignature } from "./source/pluginSourceFilesSignature";
import { pluginSourceState } from "./source/pluginSourceState";

/**
 * Record the answer and the state it was true for.
 *
 * The state is the one the plugin load read, not the one found now: each input
 * is recorded with the evaluation-time hash and physical path the load proved
 * (`hostInputHashes`, `hostInputRealpaths`). A later read proves the entry by
 * comparing those with the filesystem, so hashing the inputs again here would
 * pair an answer computed from one state with another state, and an input that
 * moved while the descriptors evaluated would bless the stale answer for as
 * long as it held still afterwards (samchon/ttsc#1504). An answer with an input
 * the load could not prove is not recorded at all: nothing could prove it later
 * either, and the next resolution walks again.
 *
 * A write failure is not reported. The cache is an optimization over a walk
 * that still works, and a read-only or full disk is a reason to be slower, not
 * a reason for `resolveCapabilityPlugins` to start throwing at a caller whose
 * contract is that it never does.
 */
export function writeCapabilityResolution(
  options: {
    cwd: string;
    tsconfig: string;
    version: string;
    env?: NodeJS.ProcessEnv;
  },
  answer: {
    /**
     * The evaluation-time content hash of each input, `null` for one proven
     * absent, as the load reported it. An input without one was not proven.
     */
    hostInputHashes: Readonly<Record<string, string | null>>;
    /**
     * The evaluation-time physical path of each input, `null` for one proven
     * absent, as the load reported it. An input without one was not proven.
     */
    hostInputRealpaths: Readonly<Record<string, string | null>>;
    /** The files the answer was computed from, as absolute paths. */
    hostInputs: readonly string[];
    manifest: string;
    /**
     * The state of every directory the binaries were keyed on, as the load
     * reported it (`pluginSources`).
     */
    pluginSources: Readonly<Record<string, string>>;
    projectContext: string | null;
    plugins: readonly ITtscCapabilityResolutionPlugin[];
  },
): void {
  const file = CapabilityResolutionFormat.resolutionFile(options);
  if (file === null) return;
  const hostInputs = [
    ...new Set(
      answer.hostInputs
        .filter((input) => input !== "")
        .map((input) => path.resolve(input)),
    ),
  ].sort();
  if (hostInputs.length === 0) return;
  const hostInputHashes: Record<string, string | null> = {};
  const hostInputRealpaths: Record<string, string | null> = {};
  for (const input of hostInputs) {
    if (
      !Object.prototype.hasOwnProperty.call(answer.hostInputHashes, input) ||
      !Object.prototype.hasOwnProperty.call(answer.hostInputRealpaths, input)
    )
      return;
    hostInputHashes[input] = answer.hostInputHashes[input]!;
    hostInputRealpaths[input] = answer.hostInputRealpaths[input]!;
  }
  const evidence = CapabilityResolutionFormat.sourceEvidence(
    CapabilityResolutionFormat.clockReference(file),
  );
  const entry: ITtscCapabilityResolutionEntry = {
    hostInputHashes,
    hostInputRealpaths,
    hostInputs,
    manifest: answer.manifest,
    pluginSources: Object.fromEntries(
      Object.entries(answer.pluginSources).map(([directory, state]) => [
        directory,
        recordPluginSource(directory, state, evidence),
      ]),
    ),
    plugins: answer.plugins.map((plugin) => ({
      binary: plugin.binary,
      capabilities: { ...plugin.capabilities },
    })),
    projectContext: answer.projectContext,
    version: CapabilityResolutionFormat.formatVersion(options.version),
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Written beside the target and renamed, so a reader never sees half an
    // entry: a truncated JSON parses as a failure and falls back, but a
    // partially written one could parse and be believed.
    const staging = `${file}.${String(process.pid)}.tmp`;
    fs.writeFileSync(staging, JSON.stringify(entry), "utf8");
    fs.renameSync(staging, file);
  } catch {
    return;
  }
}

/**
 * A plugin source as the entry records it: its state, with the digest of its
 * files and the metadata signature they were read under when a read can vouch
 * for both (`ITtscCapabilityPluginSource`).
 *
 * The digest is read here, between two signatures, because the load's own
 * reading is not one this writer can place in time: the digest is kept only
 * when both signatures agree, every stamp was separable from a reference minted
 * before the read, and the digest gives the very state the load reported, so
 * the entry never vouches for sources the binary was not built from. Anything
 * else records the state alone, which a read proves in full.
 */
function recordPluginSource(
  directory: string,
  state: string,
  evidence: ReturnType<typeof CapabilityResolutionFormat.sourceEvidence>,
): ITtscCapabilityPluginSource {
  try {
    const before = pluginSourceFilesSignature(directory, evidence);
    const digest = pluginSourceDigest(directory);
    const after = pluginSourceFilesSignature(directory, evidence);
    if (
      before !== undefined &&
      after !== undefined &&
      before.signature === after.signature &&
      after.separable &&
      pluginSourceState(directory, { sourceDigest: digest }) === state
    ) {
      return { digest, signature: after.signature, state };
    }
  } catch {
    // A source that cannot be read now is proven in full when the entry is.
  }
  return { state };
}

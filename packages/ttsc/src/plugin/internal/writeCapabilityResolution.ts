import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../internal/E2ETrace";
import { CapabilityResolutionFormat } from "./CapabilityResolutionFormat";
import type { ITtscCapabilityPluginSource } from "./ITtscCapabilityPluginSource";
import type { ITtscCapabilityResolutionEntry } from "./ITtscCapabilityResolutionEntry";
import type { ITtscCapabilityResolutionPlugin } from "./ITtscCapabilityResolutionPlugin";
import { SourceBuildCacheLayout } from "./source/SourceBuildCacheLayout";
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
 * long as it held still afterwards. An answer with an input the load could not
 * prove is not recorded at all: nothing could prove it later either, and the
 * next resolution walks again.
 *
 * A write failure is not reported. The cache is an optimization over a walk
 * that still works, and a read-only or full disk is a reason to be slower, not
 * a reason to replace a successfully discovered answer. The owning resolver
 * catches failures in its load/publication block; this does not establish a
 * never-throws contract for its earlier authority/tool lookup stages.
 *
 * Returns the published entry, or null when no complete entry was written.
 * Publication is not a freshness assertion: the reader must still prove its
 * recorded observations before dependent results can reuse it. Private opt-in
 * tracing records the reached refusal branch or successful rename. It neither
 * retries persistence nor observes an unexecuted proof comparison; failures
 * inside the trace writer cannot replace this result.
 *
 * Default workspace storage is marked before even the clock probe is written,
 * so a first answer cannot make a later root search choose a different
 * installation under the root ownership policy. The probe and answer use the
 * marker's returned physical spelling, not a retained directory handle;
 * publication assumes that path remains stable. An explicit `TTSC_CACHE_DIR`
 * remains caller-owned.
 *
 * @evidence contracts/common.md#principled-implementation Retained inputs carry load-time hash/realpath and expected authority; default root provenance is marked before clock-probe or answer publication, while source digest acceleration must reconstruct the recorded build state.
 * @evidence contracts/common.md#clear-and-simple-design The writer persists a narrow copied answer and proof entry; descriptor discovery and binary building remain outside persistence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Host proofs are not rehashed now to bless an answer computed earlier; unavailable proof prevents a write, and write failure does not invent a capability answer.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain evaluation-time proof, best-effort persistence and first-write default-root selection, with member/tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve/join, the shared physical-root marker and same-directory rename preserve OS-neutral identities; source witnesses use actual device metadata.
 * @evidence contracts/performance.md#efficient-algorithms Normalized path Set deduplication and text-sensitive sorting precede own-key proof copies. Source digest acceleration can enumerate/query signatures twice, read full source bytes and observe build environment; authority/root/probe/publication operations also cost native work. Plugin capability maps, full manifest/context/proof/source text and complete JSON serialization contribute storage and processing beyond plugin count.
 * @evidence contracts/performance.md#reuse-equivalent-work Persistence stores one complete project answer under the shared format key; later reuse must reprove these exact evaluation/build states rather than treating writing as validation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Same-directory staging cleanup is attempted in finally and can fail; serialized/copied entry data scales with the full answer and transfers to the caller/storage owner. Default entry pruning has interval/protection/failure limits and caller-selected roots remain caller-owned; transient probe removal is likewise an owning helper's attempt, with no guaranteed deletion or independent byte ceiling here.
 */
export function writeCapabilityResolution(
  options: {
    /** Invocation directory included in the shared cache-entry identity. */
    cwd: string;

    /** Selected project config identity used by the matching reader. */
    tsconfig: string;

    /** Ttsc product version paired with the cache format revision. */
    version: string;

    /** Environment selecting storage, or ambient process env when omitted. */
    env?: NodeJS.ProcessEnv;

    /** Pre-load authority key; a moved evaluation authority refuses the write. */
    expectedAuthority?: string;
  },
  answer: {
    /**
     * The evaluation-time content hash or unavailable null state reported by
     * the load. A missing own key is not a recorded observation.
     */
    hostInputHashes: Readonly<Record<string, string | null>>;

    /**
     * The evaluation-time physical path or unavailable null state reported by
     * the load. A missing own key is not a recorded observation.
     */
    hostInputRealpaths: Readonly<Record<string, string | null>>;

    /** The files the answer was computed from, as absolute paths. */
    hostInputs: readonly string[];

    /** The native plugin-manifest payload preserved verbatim. */
    manifest: string;

    /**
     * Keyed states of the directories included in the load's pluginSources
     * report; the load owns installed-package exclusions.
     */
    pluginSources: Readonly<Record<string, string>>;

    /** Native project identity payload, or null when no consumer requested it. */
    projectContext: string | null;

    /** Ordered sidecar paths and their declared capability maps. */
    plugins: readonly ITtscCapabilityResolutionPlugin[];
  },
): ITtscCapabilityResolutionEntry | null {
  let file = CapabilityResolutionFormat.resolutionFile(options);
  if (file === null) {
    E2ETrace.capabilityResolution("write-refused", {
      reason: "storage-authority-unavailable",
    });
    return null;
  }
  if (
    options.expectedAuthority !== undefined &&
    options.expectedAuthority !== file
  ) {
    E2ETrace.capabilityResolution("write-refused", {
      file,
      reason: "authority-changed",
    });
    return null;
  }
  const hostInputs = [
    ...new Set(
      answer.hostInputs
        .filter((input) => input !== "")
        .map((input) => path.resolve(input)),
    ),
  ].sort();
  if (hostInputs.length === 0) {
    E2ETrace.capabilityResolution("write-refused", {
      file,
      reason: "empty-host-inputs",
    });
    return null;
  }
  const hostInputHashes: Record<string, string | null> = {};
  const hostInputRealpaths: Record<string, string | null> = {};
  for (const input of hostInputs) {
    const hashPresent = Object.prototype.hasOwnProperty.call(
      answer.hostInputHashes,
      input,
    );
    let realpathPresent: boolean | undefined;
    if (
      !hashPresent ||
      !(realpathPresent = Object.prototype.hasOwnProperty.call(
        answer.hostInputRealpaths,
        input,
      ))
    ) {
      E2ETrace.capabilityResolution("write-refused", {
        file,
        input,
        reason: "host-proof-missing",
        hashPresent,
        realpathPresent,
      });
      return null;
    }
    hostInputHashes[input] = answer.hostInputHashes[input]!;
    hostInputRealpaths[input] = answer.hostInputRealpaths[input]!;
  }
  if (!SidecarEnvironment.read(options.env ?? process.env, "TTSC_CACHE_DIR")) {
    try {
      const physicalRoot = SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(
        path.dirname(path.dirname(file)),
      );
      file = path.join(
        physicalRoot,
        SourceBuildCacheLayout.CAPABILITY_CACHE_DIRNAME,
        path.basename(file),
      );
    } catch {
      E2ETrace.capabilityResolution("write-refused", {
        file,
        reason: "default-root-unavailable",
      });
      return null;
    }
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
  const staging = `${file}.${String(process.pid)}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Written beside the target and renamed, so a reader never sees half an
    // entry: a truncated JSON parses as a failure and falls back, but a
    // partially written one could parse and be believed.
    fs.writeFileSync(staging, JSON.stringify(entry), "utf8");
    fs.renameSync(staging, file);
    E2ETrace.capabilityResolution("write-published", {
      file,
      hostInputs: hostInputs.length,
    });
    return entry;
  } catch {
    E2ETrace.capabilityResolution("write-refused", {
      file,
      reason: "publication-exception",
    });
    return null;
  } finally {
    try {
      fs.rmSync(staging, { force: true });
    } catch {
      // Cache cleanup must not replace the uncached discovery result.
    }
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

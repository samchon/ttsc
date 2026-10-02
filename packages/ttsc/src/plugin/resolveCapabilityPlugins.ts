import fs from "node:fs";
import path from "node:path";

import { createNativeProjectContextJson } from "../compiler/internal/project/createNativeProjectContextJson";
import { resolveBinary } from "../compiler/internal/resolveBinary";
import { javascriptRuntimeCapabilities } from "../internal/javascriptRuntimeCapabilities";
import type {
  ITtscCapabilityPlugin,
  ITtscCapabilityPluginResolution,
} from "./ITtscCapabilityPlugin";
import type { ITtscCapabilityResolutionEntry } from "./internal/ITtscCapabilityResolutionEntry";
import { CapabilityResolutionFormat } from "./internal/CapabilityResolutionFormat";
import { loadProjectPlugins } from "./internal/load/loadProjectPlugins";
import { readCapabilityResolution } from "./internal/readCapabilityResolution";
import { writeCapabilityResolution } from "./internal/writeCapabilityResolution";

/**
 * The built sidecars of a project's configured plugins that declare one
 * capability.
 *
 * This is the seam a consumer outside the compiler uses to ask a plugin a
 * question the plugin declared it can answer. `ttscserver` asks for
 * `capabilities.lsp` from inside the launcher; a separate tool — `@ttsc/graph`,
 * an editor integration, a script — reaches the same answer here without
 * reimplementing plugin discovery, descriptor evaluation, and the Go source
 * build cache.
 *
 * It is contributor-agnostic by construction: the caller names a capability,
 * not a package. A project that configures no plugin, or none declaring that
 * capability, gets an empty array — which is an answer, not a failure, and is
 * the common case.
 *
 * Building a plugin is not free the first time. The Go source build is cached
 * by content. A warm query still observes runtime authority, recorded host
 * inputs, source/build state and binary presence; it can avoid descriptor
 * evaluation and rebuilding without reducing all work to one lookup.
 *
 * @param options.capability - Capability flag the plugin descriptor must
 *   declare.
 * @param options.cwd - Project root. Defaults to the current directory.
 * @param options.tsconfig - Project tsconfig path, relative to `cwd`.
 *
 * @returns One entry per declaring plugin, in configured plugin order.
 *
 * @evidence contracts/common.md#principled-implementation The compatibility API returns declaring sidecars from the shared capability-resolution owner; callers needing reusable empty-result proof use the richer resolution API.
 * @evidence contracts/common.md#clear-and-simple-design One wrapper preserves the established array result without duplicating discovery, evaluation or build policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty degraded results remain the legacy contract, but are not advertised as evidence of absence; capability selection does not route by package name.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains full discovery/build ownership, configured order and capability meaning, with separated paragraphs/tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native invocation paths and sidecar identity remain with the owning resolver; this wrapper introduces no path parsing or shell invocation.
 * @evidence contracts/performance.md#efficient-algorithms The wrapper delegates the full runtime/cache/discovery/build work to the owning resolver, then copies selected entry references in O(selected plugins). Its additional copy cost does not bound the delegated native/hash/serialization work.
 * @evidence contracts/performance.md#reuse-equivalent-work The owning resolver applies the persistent answer's recorded authority and input premises; this wrapper adds no independent cache and discards the richer validity query, so the returned array alone does not certify later freshness.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper returns caller-owned data and acquires no persistent process or retained result population.
 */
export function resolveCapabilityPlugins(options: {
  capability: string;
  cwd?: string;
  tsconfig?: string;
}): ITtscCapabilityPlugin[] {
  return [...resolveCapabilityPluginResolution(options).plugins];
}

/**
 * Resolve a capability with an owning freshness query, including empty answers.
 *
 * A missing native tool and errors inside the plugin-load/answer-publication
 * try block yield an unavailable result whose freshness is always false.
 * Initial path, authority/cache lookup and tool resolution precede that catch;
 * their exceptions are not converted there. A successful lookup is reusable
 * only while the recorded discovery and evaluation premises remain current.
 * The query never re-evaluates a descriptor or builds a plugin.
 *
 * Unrecorded descriptor reads, module-based config inheritance, indirect
 * runtime authority and failed persistence can leave a successful lookup
 * without reusable proof. Its query then returns false; successful discovery is
 * distinct from permission to reuse.
 *
 * @evidence contracts/common.md#principled-implementation Successful selection preserves the complete configured manifest and opt-in context; missing tools and caught load/publication failures produce degraded results. Dependent reuse requires the recorded input/build projections and authority checks, subject to producer declarations and sequential observation limits.
 * @evidence contracts/common.md#clear-and-simple-design One owner combines discovery and cache acceptance, exposing only selected plugins, outcome and an opaque validity query to downstream consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unproved or unavailable empty answers are never reusable success; consumers do not reconstruct a partial resolver or bypass descriptor-read declarations.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains empty-answer proof, unavailable outcomes and the non-evaluating query; the result type documents consumer responsibility and closure lifetime following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolve and shared filesystem observers preserve actual lexical/physical identities; executable and full JSON argv payloads cross the sidecar boundary without shell composition.
 * @evidence contracts/performance.md#efficient-algorithms A valid persisted answer avoids descriptor startup and Go builds, but runtime probes, repeated executable/environment key construction, full entry JSON/host hashing, source metadata/build-environment checks and binary queries still contribute native/path/file/text costs. Freshness repeats authority and cache acceptance, then compares complete serialized entries; misses delegate full discovery/build work and selection scans all configured plugins before mapping the selected ones.
 * @evidence contracts/performance.md#reuse-equivalent-work Persistent identity includes project/product version/environment/runtime authority and recorded input/source states. Callback equality compares the accepted serialized generation after current checks; it relies on producer declarations and non-atomic observation premises, not detection of every possible external read.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A reusable result's closure retains serialized proof, captured selector/path strings and authority values while selected entries carry manifest/context text; consumers own release and no independent population/byte ceiling is imposed. Discovery/proof observers own transient processes/files and their cleanup attempts, with no live evaluator intentionally retained in the result. Default disk pruning is subject to its own protection/interval/failure policy and explicit roots remain caller-owned.
 */
export function resolveCapabilityPluginResolution(options: {
  /** Capability name that selected sidecars must explicitly declare true. */
  capability: string;

  /** Invocation directory for native project/config resolution. */
  cwd?: string;

  /** Explicit config relative to cwd, or the resolver's default discovery. */
  tsconfig?: string;
}): ITtscCapabilityPluginResolution {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  // Discovery and an explicit local tsconfig can select different files from
  // the same cwd. NUL cannot occur in a filename, so this discovery key cannot
  // collide with an explicitly supplied path.
  const tsconfig = options.tsconfig ?? `${String.fromCharCode(0)}discovered`;
  const runtimeProved = capabilityRuntimeAuthorityComplete(cwd);
  const authority = runtimeProved
    ? CapabilityResolutionFormat.resolutionFile({ cwd, tsconfig })
    : null;
  const cached = runtimeProved
    ? readCapabilityResolution({ cwd, tsconfig, version })
    : null;
  if (cached !== null)
    return resolved(cached, options.capability, cwd, tsconfig, authority);

  const binary = resolveBinary();
  if (binary === null || binary === undefined) return unavailable();
  try {
    const loaded = loadProjectPlugins({
      binary,
      cwd: options.cwd,
      tsconfig: options.tsconfig,
    });
    // The manifest carries every configured plugin, not only the declaring one.
    // A sidecar reads its OWN entry out of it — that entry is where its config
    // file lives — and a manifest narrowed to the caller's capability would hand
    // it a project it does not recognize, which is an empty answer rather than an
    // error. This is the same string `runBuild` passes for a check-stage plugin.
    const manifest = JSON.stringify(
      loaded.nativePlugins.map((plugin) => ({
        config: plugin.config,
        name: plugin.name,
        stage: plugin.stage,
      })),
    );
    const wantsContext = loaded.nativePlugins.some(
      (plugin) =>
        (plugin.capabilities as Record<string, unknown> | undefined)
          ?.projectContextArgs === true,
    );
    // The files the answer was computed from, with the proof the load took of
    // each while the descriptors evaluated. A plugin's
    // `configFile` that no descriptor read is forwarded to the native plugin
    // and deferred to its transform's own proof: the answer never read it.
    const deferred = new Set(loaded.deferredHostInputs);
    const answer = {
      hostInputHashes: loaded.hostInputHashes,
      hostInputRealpaths: loaded.hostInputRealpaths,
      hostInputs: loaded.hostInputs.filter((input) => !deferred.has(input)),
      manifest,
      // What the binaries below were keyed on, which a later read proves before
      // it hands out a path.
      pluginSources: loaded.pluginSources,
      plugins: loaded.nativePlugins.map((plugin) => ({
        binary: plugin.binary,
        capabilities: Object.fromEntries(
          Object.entries(
            (plugin.capabilities as Record<string, unknown> | undefined) ?? {},
          ).map(([name, declared]) => [name, declared === true] as const),
        ),
      })),
      projectContext: wantsContext
        ? createNativeProjectContextJson(loaded.project)
        : null,
    };
    // A descriptor that did not declare what it read computed an answer no
    // recorded input can prove to a later call.
    const recorded =
      runtimeProved &&
      authority !== null &&
      CapabilityResolutionFormat.resolutionFile({ cwd, tsconfig }) ===
        authority &&
      loaded.descriptorReadsDeclared &&
      loaded.discoveryInputsComplete
        ? writeCapabilityResolution(
            { cwd, tsconfig, version, expectedAuthority: authority },
            answer,
          )
        : null;
    return recorded === null
      ? {
          isCurrent: () => false,
          plugins: select(answer, options.capability),
          status: "resolved",
        }
      : resolved(recorded, options.capability, cwd, tsconfig, authority);
  } catch {
    // A project whose plugin configuration does not load is a project the user
    // already sees an error for, from the command that compiles it. Failing here
    // would turn "your lint config has a typo" into "the graph is broken", and
    // the caller's own degraded answer is the honest one.
    return unavailable();
  }
}

/**
 * Whether the keyed executable is the actual sole descriptor runtime.
 *
 * A direct hook-capable Node executable selects itself for both direct and ttsx
 * evaluation. Bun, wrappers and startup preloads introduce additional
 * authorities that this cache format does not observe, so they are not reused.
 */
function capabilityRuntimeAuthorityComplete(cwd: string): boolean {
  if (process.env.NODE_OPTIONS?.trim()) return false;
  const runtime = process.env.TTSC_NODE_BINARY ?? process.execPath;
  if (!path.isAbsolute(runtime)) return false;
  try {
    const capabilities = javascriptRuntimeCapabilities(
      runtime,
      process.env,
      cwd,
    );
    return (
      !capabilities.bun &&
      capabilities.registerHooks &&
      capabilities.executable !== undefined &&
      fs.realpathSync.native(capabilities.executable) ===
        fs.realpathSync.native(runtime)
    );
  } catch {
    return false;
  }
}

/** A complete accepted cache generation and its owning validity query. */
function resolved(
  entry: ITtscCapabilityResolutionEntry,
  capability: string,
  cwd: string,
  tsconfig: string,
  authority: string | null,
): ITtscCapabilityPluginResolution {
  const proof = JSON.stringify(entry);
  return {
    isCurrent: () => {
      try {
        if (
          authority === null ||
          !capabilityRuntimeAuthorityComplete(cwd) ||
          CapabilityResolutionFormat.resolutionFile({ cwd, tsconfig }) !==
            authority
        )
          return false;
        const current = readCapabilityResolution({ cwd, tsconfig, version });
        return current !== null && JSON.stringify(current) === proof;
      } catch {
        return false;
      }
    },
    plugins: select(entry, capability),
    status: "resolved",
  };
}

/** Degraded absence is never evidence that the project has no publisher. */
function unavailable(): ITtscCapabilityPluginResolution {
  return { isCurrent: () => false, plugins: [], status: "unavailable" };
}

/** The declaring plugins, from a resolution however it was obtained. */
function select(
  resolution: {
    manifest: string;
    projectContext: string | null;
    plugins: readonly {
      binary: string;
      capabilities: Record<string, boolean>;
    }[];
  },
  capability: string,
): ITtscCapabilityPlugin[] {
  return resolution.plugins
    .filter(
      (plugin) =>
        plugin.binary !== "" && plugin.capabilities[capability] === true,
    )
    .map((plugin) => ({
      binary: plugin.binary,
      manifest: resolution.manifest,
      ...(plugin.capabilities.projectContextArgs === true &&
      resolution.projectContext !== null
        ? { projectContext: resolution.projectContext }
        : {}),
    }));
}

/**
 * This build, as the resolution cache's key material.
 *
 * A ttsc upgrade can change what discovery finds — a new descriptor field, a
 * different resolution order — so an entry written by another build is not this
 * build's answer.
 */
const version = ((): string => {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "..", "package.json"),
        "utf8",
      ),
    ) as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

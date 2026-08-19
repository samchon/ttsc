import fs from "node:fs";
import path from "node:path";

import { createNativeProjectContextJson } from "../compiler/internal/project/createNativeProjectContextArgs";
import { resolveBinary } from "../compiler/internal/resolveBinary";
import {
  readCapabilityResolution,
  writeCapabilityResolution,
} from "./internal/capabilityResolutionCache";
import { loadProjectPlugins } from "./internal/loadProjectPlugins";

/**
 * One plugin that declared the requested capability.
 *
 * `manifest` is the `--plugins-json` payload its sidecar needs to find its own
 * configured entry. Without it the sidecar loads an empty rule configuration
 * and answers as though the project declared nothing — an empty answer that
 * looks exactly like a project which genuinely publishes none.
 */
export interface ITtscCapabilityPlugin {
  binary: string;
  manifest: string;
  /**
   * The `--project-context-json` payload, or `undefined` when the plugin's
   * descriptor does not declare it wants one.
   *
   * A sidecar is handed a project root, not asked to derive one. Without this a
   * rule that resolves its own inputs — the documents an evidence claim reads,
   * a Prisma schema, an OpenAPI file — has no base to resolve them against, and
   * answers with an empty set rather than an error, because "this project
   * declares nothing" is a legitimate answer it cannot distinguish from "I was
   * not told where the project is".
   */
  projectContext?: string;
}

/**
 * The built sidecars of a project's configured plugins that declare one
 * capability.
 *
 * This is the seam a consumer outside the compiler needs to ask a plugin a
 * question the plugin declared it can answer. `ttscserver` already does this
 * for `capabilities.lsp`, but it does it from inside the launcher; a separate
 * tool — `@ttsc/graph`, an editor integration, a script — had no way to reach
 * the same answer without reimplementing plugin discovery, descriptor
 * evaluation, and the Go source build cache.
 *
 * It is contributor-agnostic by construction: the caller names a capability,
 * not a package. A project that configures no plugin, or none declaring that
 * capability, gets an empty array — which is an answer, not a failure, and is
 * the common case.
 *
 * Building a plugin is not free the first time. The Go source build is cached
 * by content, so a warm project pays a lookup; a cold one pays the build the
 * next `ttsc` invocation would have paid anyway.
 *
 * @param options.capability - Capability flag the plugin descriptor must
 *   declare.
 * @param options.cwd - Project root. Defaults to the current directory.
 * @param options.tsconfig - Project tsconfig path, relative to `cwd`.
 * @returns One entry per declaring plugin, in configured plugin order.
 */
export function resolveCapabilityPlugins(options: {
  capability: string;
  cwd?: string;
  tsconfig?: string;
}): ITtscCapabilityPlugin[] {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const tsconfig = options.tsconfig ?? "tsconfig.json";
  const cached = readCapabilityResolution({ cwd, tsconfig, version });
  if (cached !== null) return select(cached, options.capability);

  const binary = resolveBinary();
  if (binary === null || binary === undefined) return [];
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
    const answer = {
      hostInputs: loaded.hostInputs,
      manifest,
      plugins: loaded.nativePlugins.map((plugin) => ({
        binary: plugin.binary,
        capabilities: Object.fromEntries(
          Object.entries(
            (plugin.capabilities as Record<string, unknown> | undefined) ?? {},
          ).map(([name, declared]) => [name, declared === true] as const),
        ),
        source: plugin.source,
      })),
      projectContext: wantsContext
        ? createNativeProjectContextJson(loaded.project)
        : null,
    };
    writeCapabilityResolution({ cwd, tsconfig, version }, answer);
    return select(answer, options.capability);
  } catch {
    // A project whose plugin configuration does not load is a project the user
    // already sees an error for, from the command that compiles it. Failing here
    // would turn "your lint config has a typo" into "the graph is broken", and
    // the caller's own degraded answer is the honest one.
    return [];
  }
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

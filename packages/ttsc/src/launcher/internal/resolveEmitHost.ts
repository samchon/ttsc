import { linkedTransformPlugins } from "../../compiler/internal/sharedHostHelpers";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import {
  buildDefaultEmitHost,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";

/**
 * The per-file emit host for one owning tsconfig: the native binary ttsx runs
 * in `serve` mode, plus the linked-plugin manifest its driver activates.
 */
export interface EmitHost {
  /** Absolute path to the host binary (a transform host, or the utility host). */
  binary: string;
  /** `TTSC_LINKED_PLUGINS_JSON` for the host, or `""` when it links no plugins. */
  pluginsJson: string;
}

/**
 * Resolve the emit host a tsconfig compiles through, reusing the same plugin
 * resolution as `ttsc build`. A project that configures a transform-stage plugin
 * (typia, @ttsc/banner, …) is served by that plugin's host — the same binary
 * `ttsc build` would emit through, so a dependency shipping raw `.ts` plus its
 * own plugin keeps that plugin at runtime. A plugin-less project is served by the
 * first-party utility host. Linked transform plugins (compiled into the utility
 * host) are passed through the manifest so the host's driver runs their
 * source-preamble / program passes.
 */
export function resolveEmitHost(options: {
  tsconfig: string;
  cwd: string;
  binary: string;
  cacheDir?: string;
  noPlugins?: boolean;
}): EmitHost {
  const loaded = loadProjectPlugins({
    binary: options.binary,
    cacheDir: options.cacheDir,
    cwd: options.cwd,
    tsconfig: options.tsconfig,
    entries: options.noPlugins ? false : undefined,
  });
  const host = loaded.nativePlugins.find(
    (plugin) =>
      plugin.stage === "transform" &&
      typeof plugin.binary === "string" &&
      plugin.binary !== "",
  );
  if (host !== undefined) {
    const linked = linkedTransformPlugins(loaded.nativePlugins);
    return {
      binary: host.binary,
      pluginsJson: linked.length === 0 ? "" : serializeNativePlugins(linked),
    };
  }
  return {
    binary: buildDefaultEmitHost({
      projectRoot: loaded.project.root,
      cacheDir: options.cacheDir,
    }),
    pluginsJson: "",
  };
}

/**
 * Serialize a plugin list into the `TTSC_LINKED_PLUGINS_JSON` manifest the
 * driver reads. Only the fields the native protocol consumes are included; the
 * shape matches `runBuild`'s own serializer so a host built for `ttsc build` and
 * one served for `ttsx` read an identical manifest.
 */
function serializeNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): string {
  return JSON.stringify(
    plugins.map((plugin) => ({
      config: plugin.config,
      name: plugin.name,
      stage: plugin.stage,
    })),
  );
}

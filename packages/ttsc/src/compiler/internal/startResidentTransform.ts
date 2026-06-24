import path from "node:path";

import { loadProjectPlugins } from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import { readProjectConfig } from "./project/readProjectConfig";
import { ResidentTransformProcess } from "./residentTransformProcess";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import {
  assertSharedHostCompatibility,
  linkedTransformPlugins,
  selectSharedHostPlugin,
} from "./sharedHostHelpers";

/**
 * A started resident transform host plus the project root its keys are relative
 * to.
 */
export interface StartedResidentTransform {
  process: ResidentTransformProcess;
  projectRoot: string;
}

/**
 * Start a resident `serve` host for the configured project.
 *
 * Mirrors the plugin spawn of `transformProjectInMemory`, but launches the
 * shared host's `serve` subcommand as one long-lived process instead of a
 * per-call `transform` subprocess. The host compiles the whole project once at
 * startup and then answers per-file requests, so one caller pays the project
 * compile once and reuses it across its own per-file requests.
 *
 * Resident mode runs through the linked-plugin shared host
 * (`cmd/utility-host`), which is the only binary that exposes `serve`. It
 * therefore requires at least one transform-stage plugin; executable transform
 * hosts that own their own process are not served and must use the per-call
 * transform path. Check-stage plugins are not run by the resident host.
 */
export function startResidentTransform(
  context: ITtscCompilerContext,
): StartedResidentTransform {
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    projectRoot: context.projectRoot,
    tsconfig: context.tsconfig,
  });
  const loaded = loadProjectPlugins({
    binary: resolveBinary(context) ?? "",
    cacheDir: context.cacheDir ?? context.env?.TTSC_CACHE_DIR,
    cwd,
    entries: context.plugins,
    projectRoot: context.projectRoot,
    tsconfig: project.path,
  });
  const transformers = loaded.nativePlugins.filter(
    (plugin) => plugin.stage === "transform",
  );
  if (transformers.length === 0) {
    throw new Error(
      "ttsc: TtscService resident mode requires at least one transform-stage plugin; " +
        "use TtscCompiler.transform for projects with only check-stage plugins or none",
    );
  }
  assertSharedHostCompatibility(transformers, "source-to-source");

  const host = selectSharedHostPlugin(transformers);
  const tsgoBinary = resolveTsgo({ ...context, cwd: project.root }).binary;
  const resident = new ResidentTransformProcess({
    args: [
      "serve",
      `--tsconfig=${project.path}`,
      `--plugins-json=${serializeNativePlugins(transformers)}`,
      `--cwd=${project.root}`,
    ],
    binary: host.binary,
    cwd: project.root,
    env: residentEnv(context, tsgoBinary, loaded.nativePlugins),
  });
  return { process: resident, projectRoot: project.root };
}

/**
 * Build the environment for the resident host spawn. Matches the per-call
 * transform spawn: injects the Node, tsgo, and ttsx binaries so the host never
 * searches PATH, and forwards linked transform plugins via
 * `TTSC_LINKED_PLUGINS_JSON`.
 */
function residentEnv(
  context: ITtscCompilerContext,
  tsgoBinary: string,
  nativePlugins: readonly ITtscLoadedNativePlugin[],
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgoBinary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    ...context.env,
  };
  const linked = linkedTransformPlugins(nativePlugins);
  if (linked.length !== 0) {
    env.TTSC_LINKED_PLUGINS_JSON = serializeNativePlugins(linked);
  }
  return env;
}

/**
 * Serialize the plugin list to the `--plugins-json` /
 * `TTSC_LINKED_PLUGINS_JSON` shape the native host reads: only the fields it
 * needs, to keep the arg short.
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

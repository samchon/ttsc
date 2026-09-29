import path from "node:path";

import { resolveNodeBinary } from "../../internal/resolveNodeBinary";
import { loadProjectPlugins } from "../../plugin/internal/load/loadProjectPlugins";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import { ResidentTransformProcess } from "./ResidentTransformProcess";
import type { StartedResidentTransform } from "./StartedResidentTransform";
import { readProjectConfig } from "./project/readProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import { assertSharedHostCompatibility } from "./sharedHost/assertSharedHostCompatibility";
import { clearInheritedSemanticConfigPath } from "./sharedHost/clearInheritedSemanticConfigPath";
import { clearInheritedTsgoArgs } from "./sharedHost/clearInheritedTsgoArgs";
import { inheritedSidecarEnv } from "./sharedHost/inheritedSidecarEnv";
import { linkedTransformPlugins } from "./sharedHost/linkedTransformPlugins";
import { publishLinkedTransformPlugins } from "./sharedHost/publishLinkedTransformPlugins";
import { resolvePluginConfigDir } from "./sharedHost/resolvePluginConfigDir";
import { selectSharedHostPlugin } from "./sharedHost/selectSharedHostPlugin";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";

/**
 * Start a resident `serve` host for the configured project.
 *
 * Mirrors the plugin spawn of `transformProjectInMemory`, but launches the
 * shared host's `serve` subcommand as one long-lived process instead of a
 * per-call `transform` subprocess. The host compiles the whole project once at
 * startup and then answers per-file requests, so one caller pays the project
 * compile once and reuses it across its own per-file requests.
 *
 * The project must contain a transform-stage plugin. Linked-only projects use
 * the generated `cmd/utility-host`, which implements `serve`; a selected custom
 * executable transform owner must implement that same protocol. Check-stage
 * plugins are not run by this resident lane.
 *
 * The returned process transfers to the caller, which must dispose it. Startup
 * fixes the project and plugins; replacing that configuration requires a new
 * host rather than reusing a process built for the previous selection.
 *
 * @evidence contracts/common.md#principled-implementation The configured transform population selects one compatible compiler owner, and its serve protocol owns project-relative replies; linked libraries execute within that owner's Program, while custom executable owners must supply the same protocol.
 * @evidence contracts/common.md#clear-and-simple-design Startup resolves project, plugin ownership, compiler and environment before acquiring the child, then returns the process together with its project anchor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing transforms and conflicting executable owners are setup errors; the selected host is not guessed from a plugin name or rescued through a different compiler after an incompatible selection.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs document startup reuse, host protocol requirements, ignored check plugins and mandatory caller disposal following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution anchors cwd and config, environment composition uses native name identity, and process startup passes argv separately without shell quoting.
 * @evidence contracts/performance.md#efficient-algorithms Filtering and manifest projection take O(P) plugin visits and O(L) returned manifest data; discovery and source builds use the loader's validated cache rather than invoking one transform process per requested file.
 * @evidence contracts/performance.md#reuse-equivalent-work The returned fixed-project host shares its committed transformed-text cache across the caller's requests; ordered updates refresh producer state, while changed startup selection requires a replacement host.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Configuration and environment are prepared before child acquisition, and the returned handle transfers cleanup responsibility to the caller; the resident client retires pipes and pending calls when disposal or transport failure ends that lifetime.
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
    cacheDir:
      context.cacheDir ??
      SidecarEnvironment.read(context.env, "TTSC_CACHE_DIR"),
    cwd,
    entries: context.plugins,
    env: inheritedSidecarEnv(context.env, context.binary),
    pluginConfigDir: context.pluginConfigDir,
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
    env: residentEnv(context, project.root, tsgoBinary, loaded.nativePlugins),
  });
  return { process: resident, projectRoot: project.root };
}

/**
 * Build the environment for the resident host spawn. Matches the per-call
 * transform spawn: injects the Node, tsgo, and ttsx binaries so the host never
 * searches PATH, sets `TTSC_PLUGIN_CONFIG_DIR` when the caller declared a
 * plugin config anchor (an embedder compiling through a generated wrapper
 * tsconfig) so config-file discovery walks the real project instead of the
 * wrapper's temp-dir ancestry, and forwards linked transform plugins via
 * `TTSC_LINKED_PLUGINS_JSON`.
 */
function residentEnv(
  context: ITtscCompilerContext,
  projectRoot: string,
  tsgoBinary: string,
  nativePlugins: readonly ITtscLoadedNativePlugin[],
): NodeJS.ProcessEnv {
  const pluginConfigDir = resolvePluginConfigDir(context);
  const env = SidecarEnvironment.merge(
    process.env,
    {
      ...(pluginConfigDir === undefined
        ? {}
        : { TTSC_PLUGIN_CONFIG_DIR: pluginConfigDir }),
      TTSC_TTSX_BINARY:
        process.env.TTSC_TTSX_BINARY ??
        path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    },
    context.env,
    { TTSC_TSGO_BINARY: tsgoBinary },
  );
  const node = resolveNodeBinary(env, projectRoot);
  SidecarEnvironment.write(env, "TTSC_NODE_BINARY", node);
  // The anchor is per-invocation state owned by this host: when this run
  // declared none (and the caller's env does not name one), drop any value
  // inherited from an ancestor ttsc process so a nested build never
  // mis-anchors its plugins at the outer project.
  SidecarEnvironment.write(
    env,
    "TTSC_PLUGIN_CONFIG_DIR",
    SidecarEnvironment.read(context.env, "TTSC_PLUGIN_CONFIG_DIR") ??
      pluginConfigDir,
  );
  // This lane forwards no tsgo argv of its own, so anything inherited belongs
  // to an outer ttsc run and must not reach the resident sidecar.
  clearInheritedTsgoArgs(env, context.env);
  clearInheritedSemanticConfigPath(env, context.env);
  publishLinkedTransformPlugins(
    env,
    context.env,
    linkedTransformPlugins(nativePlugins),
  );
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

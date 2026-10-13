import type {
  BuildOptions,
  Plugin as EsbuildPlugin,
  ResolveResult,
} from "esbuild";
import fs from "node:fs";
import path from "node:path";

import { typescriptTransformSourcePattern } from "../source/typescriptTransformSourcePattern";
import type { TtscTransformResult } from "../transform/TtscTransformResult";
import { inlineSourceMap } from "../transform/utils/inlineSourceMap";
import { isHostWrapperQuery } from "../transform/utils/isHostWrapperQuery";
import { stripQuery } from "../transform/utils/stripQuery";

/**
 * Exposes imports introduced by ttsc plugins to Vite's dependency scanner.
 *
 * Vite scans files without its normal transform hooks. Its optimizer plugins
 * are the supported connection: Rolldown transforms the scanner's loaded text,
 * while esbuild scans transformed modules in a separate namespace and also
 * imports each original through Vite's loader. That original graph preserves
 * glob, JSX and user loaders; the transformed graph adds complete relative
 * import chains without a second parser or artificial exports.
 *
 * Vite's esbuild scanner supplies stdin; dependency bundling supplies entry
 * points. Only the scanner gets the extra original graph, because publishing
 * that graph would execute untransformed code alongside transformed code.
 * Bundling applies ordinary transforms after user loaders instead. Supplying
 * both stdin and entryPoints is not a supported Vite optimizer configuration.
 *
 * The caller owns compilation, aliases, validation and cache lifetime. Each
 * environment keeps its own optimizer settings and existing plugins. Disabled
 * discovery is left alone, and repeated installation on one settings object
 * within this call is suppressed.
 *
 * @evidence contracts/common.md#principled-implementation Official optimizer hooks and the host's Rolldown capability select the real backend. Esbuild's stdin scan parses transformed namespaces plus actual-loader originals, while entry-point dependency bundles receive ordinary transforms without duplicate runtime source.
 * @evidence contracts/common.md#clear-and-simple-design One installer selects the host's resolved optimizer backend and delegates compilation to the adapter's existing transform owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Uses published setup, input options, namespaces, load, resolve and transform APIs. Synthetic original-import edges belong only to the unpublished dependency scan, and no host method, global, package name or expected dependency is replaced or special-cased.
 * @evidence contracts/common.md#meaningful-documentation Prose explains the missing transform phase, original-loader ownership, scan versus bundle behavior, caller-owned generation validity and environment-specific option preservation.
 * @evidence contracts/portability.md#os-neutral-implementation Node reads native paths and derives their resolve directories; Vite's resolver retains workspace, alias and filesystem identity policy. No OS-name or case assumption is introduced.
 * @evidence contracts/performance.md#efficient-algorithms Esbuild scans at most a transformed and an original graph node per reached TypeScript source, sharing host cycle detection and parsing. Each interception delegates native resolution once. Active equal requests yield to the next resolver while the initiating interception retains the transformed graph edge; compilation and validation retain their own costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Scanner deliveries use the caller's transform cache and proof rules. Existing optimizer plugin objects remain shared by identity. Each distinct backend settings object receives one Rolldown transform or one prepended esbuild scanner and one appended bundle transform per installation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Settings retain plugin closures for their Vite configuration lifetime. Active resolution keys are removed in finally; module graph state belongs to the host's scanner context. No child build, module history or separate compiler cache is retained, and the caller releases generations at its existing Vite boundaries.
 */
export function installViteDependencyScanPlugins(
  config: {
    command: string;
    optimizeDeps: {
      disabled?: boolean | "build" | "dev";
      noDiscovery?: boolean;
      esbuildOptions?: BuildOptions;
      rolldownOptions?: { plugins?: unknown };
    };
    environments?: Record<
      string,
      { optimizeDeps?: typeof config.optimizeDeps }
    >;
  },
  includes: (file: string) => boolean,
  transform: (
    source: string,
    file: string,
  ) => Promise<TtscTransformResult | undefined>,
  backend: "esbuild" | "rolldown",
): void {
  if (config.command !== "serve") return;
  const installed = new Set<object>();
  const backends = new Set<object>();
  for (const options of [
    config.optimizeDeps,
    ...Object.values(config.environments ?? {}).map(
      (environment) => environment.optimizeDeps,
    ),
  ]) {
    if (
      options === undefined ||
      installed.has(options) ||
      options.noDiscovery === true ||
      options.disabled === true ||
      options.disabled === "dev"
    )
      continue;
    installed.add(options);
    if (backend === "rolldown") {
      options.rolldownOptions ??= {};
      if (backends.has(options.rolldownOptions)) continue;
      backends.add(options.rolldownOptions);
      const existing = options.rolldownOptions.plugins;
      options.rolldownOptions.plugins = [
        ...(existing === undefined ? [] : [existing]),
        {
          name: "ttsc-dependency-scan",
          async transform(source: string, file: string) {
            if (isHostWrapperQuery(file) || !includes(stripQuery(file))) return;
            return transform(source, stripQuery(file));
          },
        },
      ];
      continue;
    }
    options.esbuildOptions ??= {};
    if (backends.has(options.esbuildOptions)) continue;
    backends.add(options.esbuildOptions);
    const plugin: EsbuildPlugin = {
      name: "ttsc-dependency-scan",
      setup(build) {
        if (build.initialOptions.stdin === undefined) return;
        const namespace = "ttsc-dependency-scan";
        const originalPrefix = "ttsc-dependency-original:";
        const resolving = new Set<string>();
        build.onResolve(
          { filter: /^ttsc-dependency-original:/, namespace },
          (imported) => ({
            path: imported.path.slice(originalPrefix.length),
            namespace: "file",
            pluginData: imported.pluginData,
          }),
        );
        build.onResolve({ filter: /.*/ }, async (imported) => {
          if (
            imported.namespace !== "file" &&
            imported.namespace !== namespace &&
            imported.namespace !== ""
          )
            return;
          const key = JSON.stringify([
            imported.namespace === namespace
              ? "file"
              : imported.namespace || "file",
            imported.path,
            imported.importer,
            imported.resolveDir,
            imported.kind,
            imported.with,
          ]);
          // Equal active requests include both self recursion and concurrent
          // duplicates. Their raw edges cannot remove the first request's
          // transformed node, which still exposes the added dependency closure.
          if (resolving.has(key)) return;
          resolving.add(key);
          let resolved: ResolveResult;
          try {
            resolved = await build.resolve(imported.path, {
              importer: imported.importer,
              resolveDir: imported.resolveDir,
              namespace: "file",
              kind: imported.kind,
              pluginData: imported.pluginData,
              with: imported.with,
            });
          } finally {
            resolving.delete(key);
          }
          if (
            resolved.errors.length !== 0 ||
            resolved.external ||
            resolved.namespace !== "file" ||
            !includes(resolved.path) ||
            isHostWrapperQuery(resolved.suffix)
          )
            return resolved;
          const loader =
            build.initialOptions.loader?.[path.extname(resolved.path)];
          if (
            loader !== undefined &&
            !["js", "jsx", "ts", "tsx"].includes(loader)
          )
            return resolved;
          return { ...resolved, namespace, pluginData: resolved };
        });
        build.onLoad(
          { filter: typescriptTransformSourcePattern, namespace },
          async ({ path: file, pluginData }) => {
            const resolved = pluginData as ResolveResult;
            const source = await fs.promises.readFile(file, "utf8");
            const transformed = await transform(source, file);
            return {
              contents: `${transformed?.code ?? source}\nimport ${JSON.stringify(originalPrefix + file)};\n`,
              loader:
                build.initialOptions.loader?.[path.extname(file)] ??
                (file.endsWith(".tsx") ? "tsx" : "ts"),
              resolveDir: path.dirname(file),
              pluginData: resolved.pluginData,
            };
          },
        );
      },
    };
    const bundle: EsbuildPlugin = {
      name: "ttsc-dependency-transform",
      setup(build) {
        if (build.initialOptions.stdin !== undefined) return;
        build.onLoad(
          { filter: typescriptTransformSourcePattern, namespace: "file" },
          async ({ path: file }) => {
            if (!includes(file)) return;
            const loader =
              build.initialOptions.loader?.[path.extname(file)] ??
              (file.endsWith(".tsx") ? "tsx" : "ts");
            if (!["js", "jsx", "ts", "tsx"].includes(loader)) return;
            const source = await fs.promises.readFile(file, "utf8");
            const result = await transform(source, file);
            if (result === undefined) return;
            return {
              contents: inlineSourceMap(result),
              loader,
              resolveDir: path.dirname(file),
            };
          },
        );
      },
    };
    options.esbuildOptions.plugins = [
      plugin,
      ...(options.esbuildOptions.plugins ?? []),
      bundle,
    ];
  }
}

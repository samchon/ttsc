import { isTransformTarget } from "../isTransformTarget";
import { stripQuery } from "../transform/utils/stripQuery";
import { TTSC_SOURCE_MAP_LOADER } from "./TTSC_SOURCE_MAP_LOADER";

/**
 * Put {@link restoreTtscSourceMap} right after unplugin's transform loader in a
 * webpack or Rspack compiler (samchon/ttsc#1392).
 *
 * Unplugin adds its transform rule to the front of `module.rules` before it
 * calls the plugin's own `webpack` or `rspack` hook, which is where this runs.
 * Adding this rule to the front afterwards puts its loader ahead of unplugin's
 * in the `pre` loader list, and loaders run from the end of that list, so this
 * one receives what the ttsc transform produced before any other loader does.
 * Only a module the transform can target gets the loader.
 *
 * @param compiler The compiler being set up, whose rules are extended.
 *
 * @evidence contracts/common.md#principled-implementation The pre-loader order places map restoration immediately after the owned transform, so downstream loaders receive maps for that transform's text.
 * @evidence contracts/common.md#clear-and-simple-design One filtered rule installs the adapter; it does not introduce another transform pipeline or duplicate host loader execution.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler's documented rule extension owns this integration; no foreign loader method is patched and the identifier names the adapter rule.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains reverse loader order and the transformed-module filter, so the seemingly reversed insertion order remains maintainable.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Adds one rule object to the compiler's rules for the compiler's life; it
 *   acquires no handle.
 */
export function registerTtscSourceMapLoader(compiler: {
  options: { module: { rules: unknown[] } };
}): void {
  compiler.options.module.rules.unshift({
    enforce: "pre",
    use: (data: { resource?: string | null }) =>
      typeof data.resource === "string" &&
      isTransformTarget(stripQuery(data.resource))
        ? [
            {
              ident: "ttsc-unplugin-source-map",
              loader: TTSC_SOURCE_MAP_LOADER,
            },
          ]
        : [],
  });
}

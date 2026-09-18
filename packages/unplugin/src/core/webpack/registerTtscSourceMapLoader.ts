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

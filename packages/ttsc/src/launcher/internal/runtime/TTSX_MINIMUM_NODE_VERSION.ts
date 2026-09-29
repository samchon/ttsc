/**
 * Minimum Node.js API version accepted before loader capability checks. The
 * synchronous `module.registerHooks` (Node 22.15.0) is the highest floor among
 * the runtime APIs these hooks depend on — `stripTypeScriptTypes` (22.13.0) and
 * the child's `--disable-warning` flag (20.11.0) are both lower — so it sets
 * the effective minimum. Kept in sync with
 * `packages/ttsc/package.json#engines.node` and the documented requirement in
 * `website/src/content/docs/development/index.mdx`. Actual hook capabilities
 * can still reject a release above this API floor.
 */
export const TTSX_MINIMUM_NODE_VERSION = "22.15.0";

import type { ITtscLintPluginMeta } from "./ITtscLintPluginMeta";

/**
 * Plugin descriptor exported by a `@ttsc/lint` contributor package.
 *
 * The shape intentionally mirrors ESLint's flat-config plugin object so a
 * contributor can read like an ESLint plugin at a glance:
 *
 * ```ts
 * // ttsc-lint-plugin-demo/src/index.ts
 * import type { ITtscLintPlugin } from "@ttsc/lint";
 * import path from "node:path";
 *
 * const plugin: ITtscLintPlugin = {
 *   meta: {
 *     name: "ttsc-lint-plugin-demo",
 *     version: "0.1.0",
 *     namespace: "demo",
 *   },
 *   rules: ["no-todo-comment"],
 *   source: path.resolve(__dirname, "..", "rules"),
 * };
 *
 * export default plugin;
 * ```
 *
 * The only field with runtime semantics is `source`: it points at the
 * contributor's Go source directory. `@ttsc/lint`'s factory passes that path to
 * ttsc's plugin builder, which links the contributor into the host binary at
 * build time. `meta.namespace` and `rules` are advisory (used for type
 * inference and diagnostic messages); the authoritative rule registration
 * happens in the Go `init()` of the contributor module.
 */
export interface ITtscLintPlugin {
  /**
   * Plugin metadata. Optional, but `meta.namespace` is the conventional source
   * for the rule-name prefix; when absent, the tsconfig `plugins` map key fills
   * that role.
   */
  meta?: ITtscLintPluginMeta;

  /**
   * Rule names exported by the Go side, used for TypeScript autocomplete in
   * user configs. Purely advisory — the Go `init()` is the registration
   * authority. Missing entries will not be flagged at runtime.
   */
  rules?: readonly string[];

  /**
   * Absolute path to the contributor's Go source directory.
   *
   * Resolve with `path.resolve(__dirname, ...)` so the path stays valid
   * regardless of where the consumer's `node_modules` lives.
   */
  source: string;
}

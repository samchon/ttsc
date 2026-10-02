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
 * build time. Metadata and listed rule names are advisory. The lint config's
 * plugins-map key selects the namespace, and authoritative rule registration
 * happens in the Go `init()` of the contributor module.
 *
 * @evidence contracts/common.md#principled-implementation The required source path identifies contributor Go code; optional metadata and names do not replace Go registration.
 * @evidence contracts/common.md#clear-and-simple-design The descriptor separates build input from advisory metadata without introducing a JavaScript rule implementation surface.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Contributors enter through the supported source descriptor and Go registry, without replacing host methods.
 * @evidence contracts/common.md#meaningful-documentation The example and member comments explain source ownership and advisory fields; paragraphs and documented members remain separated under the documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintPlugin is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintPlugin is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintPlugin is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintPlugin is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintPlugin {
  /**
   * Optional descriptive metadata. The lint config's `plugins` map key selects
   * the contributor namespace; this metadata does not override registration.
   */
  meta?: ITtscLintPluginMeta;

  /**
   * Descriptive rule names exported by the Go side. The list does not define
   * configuration types or register rules; those use TypeScript module
   * augmentation and Go `init()` respectively. Missing entries are not flagged
   * at runtime.
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

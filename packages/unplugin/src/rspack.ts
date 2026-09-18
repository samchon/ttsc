import { unplugin } from "./core/unplugin";

/**
 * The Rspack adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside Rspack compilations. Plugin instances created with
 * equal options share one generation cache, so the client, server, and edge
 * compilers of one build compile the program once (samchon/ttsc#1396), while
 * the transform core and the watch-input contract are the ones every adapter
 * shares. This module is the `@ttsc/unplugin/rspack` subpath entry and loads
 * the same core as every other entry.
 */
const rspack: typeof unplugin.rspack = unplugin.rspack;

export default rspack;

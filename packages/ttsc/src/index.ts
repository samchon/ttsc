/**
 * Ttsc — public TypeScript entry.
 *
 * The package root intentionally exposes only the programmatic compiler class
 * and the plugin-author contracts. CLI launcher functions, binary resolution,
 * project parsing helpers, and native build helpers stay off it so the public
 * package surface remains small and stable.
 */

export * from "./plugin/ITtscCapabilityPlugin";
export * from "./plugin/resolveCapabilityPlugins";
export * from "./TtscCompiler";
export * from "./TtscServiceRequestOptions";
export * from "./TtscService";
export * from "./structures/index";

/**
 * ttsc — public TypeScript entry.
 *
 * The package root intentionally exposes only the programmatic compiler class
 * and the plugin-author contracts. CLI launcher functions, binary resolution,
 * project parsing helpers, and native build helpers stay internal so the
 * public package surface remains small and stable.
 */

export * from "./TtscCompiler";
export * from "./structures/index";

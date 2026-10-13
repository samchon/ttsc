/**
 * Publish the CommonJS source extensions served by the installed runtime hooks.
 *
 * Tools such as tsconfig-paths enumerate the process registry before asking
 * Node to resolve a file, and rechoir checks it before loading a typed config.
 * A module-local copy cannot satisfy those checks. Add only missing entries
 * using Node's JavaScript handler; registerHooks still owns source compilation
 * and existing loader handlers keep their identity. Node probes these entries
 * after its existing extensions, preserving JavaScript precedence.
 *
 * @evidence contracts/common.md#principled-implementation The public require.extensions registry advertises supported CommonJS source loading to consumers that inspect extensions before resolution; absent entries delegate to Node's existing JavaScript handler, which consumes the source supplied by registerHooks.
 * @evidence contracts/common.md#clear-and-simple-design One installation operation publishes loader capability without adding a second compilation or resolution path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only missing public registry entries are added; no foreign handler or method is replaced and no consumer identity affects production behavior. The source suffixes describe the supported CommonJS contract rather than fixture-specific routes.
 * @evidence contracts/common.md#meaningful-documentation The prose explains why process-wide advertisement is needed, who compiles the source, which handlers remain authoritative and how native precedence is preserved.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Registry updates use JavaScript property semantics without filesystem, path or process arguments; Node's loader owns native resolution.
 * @evidence contracts/performance.md#efficient-algorithms A fixed set of three CommonJS source extensions requires constant time and space, without scanning modules or files.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This capability publication shares no computed compilation or resolution result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller's process registry retains at most three added references to an existing Node handler for the installed hooks' process lifetime; no handle or task is acquired.
 */
export function advertiseTypeScriptExtensions(
  extensions: NodeJS.RequireExtensions,
): void {
  for (const extension of [".ts", ".tsx", ".cts"])
    extensions[extension] ??= extensions[".js"]!;
}

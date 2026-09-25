/**
 * One `replace` directive of a plugin module's `go.mod` whose target is a local
 * directory outside the module (`pluginModuleReplaceDirectories`).
 *
 * `go build` compiles that directory in place, so the build keys it, reports its
 * state, and resolves a relative spelling from the module's own directory
 * (samchon/ttsc#1506).
 */
export interface IPluginModuleReplaceDirectory {
  /** The target's absolute path. */
  directory: string;
  /** The replaced module path, the directive's left side. */
  modulePath: string;
  /** The target as `go.mod` spells it. */
  spelled: string;
  /** The replaced version, when the directive names one. */
  version?: string;
}

/**
 * Deferred barrel for the build and TypeScript-serving dependencies of
 * `installRuntimeHooks`. Loaded once on first TypeScript or prebuild demand so
 * plain JavaScript and CommonJS descriptor evaluations never pay the module
 * load cost of the compiler build chain.
 */
export { EmitOwnershipIndex } from "../../../compiler/internal/EmitOwnershipIndex";
export { RuntimeBuildCache } from "../../../compiler/internal/build/RuntimeBuildCache";
export { RuntimeBuildExplanation } from "../../../compiler/internal/build/RuntimeBuildExplanation";
export { privateRuntimeRootDir } from "../../../compiler/internal/build/privateRuntimeRootDir";
export { runBuild } from "../../../compiler/internal/build/runBuild";
export { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
export { resolveOwningProjectConfig } from "../../../compiler/internal/project/resolveOwningProjectConfig";
export { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
export { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
export { spawnNative } from "../../../compiler/internal/spawnNative";
export { createProjectTempDirectory } from "../../../internal/createProjectTempDirectory";
export { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
export { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
export { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
export { recordCacheFileUse } from "../../../plugin/internal/source/recordCacheFileUse";
export { resolveSourceBuildCachePaths } from "../../../plugin/internal/source/resolveSourceBuildCachePaths";
export { buildSingleRootProject } from "../buildSingleRootProject";
export { runtimeCompilerArgs } from "../runtimeCompilerArgs";
export { DependencyBuildAdmission } from "./DependencyBuildAdmission";
export { DependencyBuildGeneration } from "./DependencyBuildGeneration";
export { OwnedProjectSource } from "./OwnedProjectSource";
export { RuntimeDependencyPrebuild } from "./RuntimeDependencyPrebuild";
export { RuntimeEmitProvenance } from "./RuntimeEmitProvenance";
export { RuntimeEntrySources } from "./RuntimeEntrySources";
export { RuntimeIsolatedEmit } from "./RuntimeIsolatedEmit";
export { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";
export { RuntimeModuleFormat } from "./RuntimeModuleFormat";
export { RuntimeProjectOwnership } from "./RuntimeProjectOwnership";
export { dependencyCacheKey } from "./dependencyCacheKey";
export { dependencyCacheRoot } from "./dependencyCacheRoot";
export { projectModuleOptions } from "./projectModuleOptions";
export { readDependencyCache } from "./readDependencyCache";
export { selectRuntimePluginPolicy } from "./selectRuntimePluginPolicy";

/**
 * `@ttsc/playground` — reusable Web Worker + React scaffolding for in-browser
 * ttsc playgrounds built on `@ttsc/wasm`.
 *
 * The package is organized by concern: the `compiler/*` modules implement the
 * worker-side `ICompilerService` contract; the `npm/*` modules install
 * on-the-fly npm dependencies into the wasm MemFS; the `sandbox/*` modules
 * drive an in-page `new Function` execute sandbox; the `react/*` modules render
 * the shell, editor, and result panes.
 *
 * The package root re-exports everything; sub-path imports are not needed.
 */

// ── compiler / worker core ────────────────────────────────────────────────
export { buildTsconfigJSON } from "./compiler/buildTsconfigJSON";
export { createTypiaSourcePackMount } from "./compiler/createTypiaSourcePackMount";
export { createWorkerCompiler } from "./compiler/createWorkerCompiler";
export { DEFAULT_ENTRY_FILE } from "./compiler/DEFAULT_ENTRY_FILE";
export { DEFAULT_LINT_PLUGIN_NAME } from "./compiler/DEFAULT_LINT_PLUGIN_NAME";
export { DEFAULT_PLAYGROUND_COMPILER_OPTIONS } from "./compiler/DEFAULT_PLAYGROUND_COMPILER_OPTIONS";
export { DEFAULT_TSCONFIG_PATH } from "./compiler/DEFAULT_TSCONFIG_PATH";
export { DEFAULT_TYPIA_PLUGIN_NAME } from "./compiler/DEFAULT_TYPIA_PLUGIN_NAME";
export { DEFAULT_WORK_DIR } from "./compiler/DEFAULT_WORK_DIR";
export { installDependenciesIntoMemFS } from "./compiler/installDependenciesIntoMemFS";
export { installTypiaSourcePack } from "./compiler/installTypiaSourcePack";
export { lineColumnOf } from "./compiler/lineColumnOf";
export { loadTypiaSourcePack } from "./compiler/loadTypiaSourcePack";
export { mapDiagnostic } from "./compiler/mapDiagnostic";
export { normalizeError } from "./compiler/normalizeError";
export { normalizeNodeModulePath } from "./compiler/normalizeNodeModulePath";
export { pickEmittedJS } from "./compiler/pickEmittedJS";

// ── npm-from-the-browser dependency installer ─────────────────────────────
export { BUILT_IN_PLAYGROUND_PACKAGES } from "./npm/BUILT_IN_PLAYGROUND_PACKAGES";
export { collectExternalPackageNames } from "./npm/collectExternalPackageNames";
export { installPlaygroundDependencies } from "./npm/installPlaygroundDependencies";
export { packageNameFromSpecifier } from "./npm/packageNameFromSpecifier";

// ── typia runtime sandbox (CJS-flavoured require over a pack JSON) ────────
export { createSandboxRequire } from "./sandbox/createSandboxRequire";
export { loadTypiaRuntimePack } from "./sandbox/loadTypiaRuntimePack";

// ── React UI surface ──────────────────────────────────────────────────────
export { ConsoleViewer } from "./react/ConsoleViewer";
export { createCompilerClient } from "./react/createCompilerClient";
export { DEFAULT_OPTION_TOGGLES } from "./react/DEFAULT_OPTION_TOGGLES";
export { DependencyProgressModal } from "./react/DependencyProgressModal";
export { DiagnosticsPanel } from "./react/DiagnosticsPanel";
export { ExamplePicker } from "./react/ExamplePicker";
export { LintPane } from "./react/LintPane";
export { OptionsPanel } from "./react/OptionsPanel";
export { PlaygroundShell } from "./react/PlaygroundShell";
export { ResultViewer } from "./react/ResultViewer";
export { SourceEditor } from "./react/SourceEditor";

// ── structured types ──────────────────────────────────────────────────────
export * from "./structures/index";

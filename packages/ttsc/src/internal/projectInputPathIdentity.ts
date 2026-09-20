/**
 * Public entry of `ttsc/path-identity`.
 *
 * The filesystem-identity rules that decide when two spellings name one file
 * (Windows 8.3 names, symlinks and junctions, per-directory case sensitivity,
 * extended-length prefixes) are shared by the compiler host, the watch
 * launcher, the LSP host, `@ttsc/unplugin`, and the VS Code extension. This
 * barrel is the one module path those consumers import, so the implementation
 * can keep one declaration per file below `pathIdentity/`.
 *
 * It also carries the compiler's own answer to which spelling of a selected
 * project is the one its Program and its plugins see, `resolveProjectIdentity`,
 * so an adapter that writes a config or a path for the compiler anchors it
 * exactly where the compiler would (samchon/ttsc#1456).
 */
export * from "./pathIdentity/FilesystemPathIdentity";
export * from "./pathIdentity/FilesystemPathIdentityOperations";
export * from "./pathIdentity/FilesystemPathIdentityContext";
export * from "./pathIdentity/createFilesystemPathIdentityContext";
export * from "./pathIdentity/isFilesystemPathIdentityWithin";
export * from "./pathIdentity/resolveFilesystemPath";
export * from "./pathIdentity/ProjectInputPathIdentity";
export * from "./pathIdentity/ProjectInputPathIdentityOperations";
export * from "./pathIdentity/ProjectInputPathIdentityContext";
export * from "./pathIdentity/createProjectInputPathIdentityContext";
export * from "./pathIdentity/isProjectInputPathIdentityWithin";
export * from "./pathIdentity/resolveProjectInputPath";
export * from "../compiler/internal/project/resolveProjectIdentity";
export type { ITtscProjectIdentity } from "../structures/internal/ITtscProjectIdentity";
export type { ITtscProjectLocatorOptions } from "../structures/internal/ITtscProjectLocatorOptions";

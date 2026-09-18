/**
 * Public entry of `ttsc/path-identity`.
 *
 * The filesystem-identity rules that decide when two spellings name one file
 * (Windows 8.3 names, symlinks and junctions, per-directory case sensitivity,
 * extended-length prefixes) are shared by the compiler host, the watch
 * launcher, the LSP host, `@ttsc/unplugin`, and the VS Code extension. This
 * barrel is the one module path those consumers import, so the implementation
 * can keep one declaration per file below `pathIdentity/`.
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

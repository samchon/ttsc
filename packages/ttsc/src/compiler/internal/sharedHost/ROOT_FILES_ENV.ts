/**
 * Environment channel carrying the JSON-encoded root files that replace the
 * file list of the project a native host compiles. Mirrors
 * `driver.RootFilesEnv` on the Go side.
 *
 * `ttsx` publishes it for a file its owning project does not list, so the
 * project's config is parsed where it lives and only its file list changes.
 */
export const ROOT_FILES_ENV = "TTSC_ROOT_FILES";

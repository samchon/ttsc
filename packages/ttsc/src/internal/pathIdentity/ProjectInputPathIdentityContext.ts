import type { FilesystemPathIdentityContext } from "./FilesystemPathIdentityContext";

/**
 * A project-input identity resolver; an alias of
 * {@link FilesystemPathIdentityContext}, so project inputs and every other path
 * are compared by one rule.
 */
export type ProjectInputPathIdentityContext = FilesystemPathIdentityContext;

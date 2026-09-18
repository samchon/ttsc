import type { RuntimeManifest } from "./RuntimeManifest";

/**
 * Options of {@link installRuntimeHooks}.
 *
 * Direct `ttsx` installs the hooks without options: its one entry project was
 * prepared by the parent before the child started. `ttsc/register` passes
 * `prepareEntry`, because a host such as Mocha discovers TypeScript roots only
 * after the hooks are live.
 */
export interface RuntimeHookOptions {
  /** Prepare and type-check a TypeScript root discovered after registration. */
  prepareEntry?: (filename: string) => RuntimeManifest;
}

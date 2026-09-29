import type { RuntimeEntryPreparer } from "./RuntimeEntryPreparer";

/**
 * Options of {@link installRuntimeHooks}.
 *
 * Direct `ttsx` installs the hooks without options: its one entry project was
 * prepared by the parent before the child started. `ttsc/register` passes
 * `prepareEntry`, because a host such as Mocha discovers TypeScript roots only
 * after the hooks are live.
 *
 * @evidence contracts/common.md#principled-implementation An optional preparation callback distinguishes a prebuilt direct entry from a host that discovers roots after registration; absence preserves the direct launcher's existing manifest ownership.
 * @evidence contracts/common.md#clear-and-simple-design The single optional callback delegates checked preparation to its owner instead of mixing compiler options or build state into hook configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Host preparation is an explicit injection boundary; this options type introduces no foreign mutation or consumer-specific branch.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain why the callback is optional and how direct ttsx differs from a discovering host, while the field retains native documentation without tags.
 * @evidence contracts/portability.md#os-neutral-implementation The callback's named type specifies a resolved native filename and an owning manifest, keeping filesystem representation explicit at the preparation boundary.
 */
export interface RuntimeHookOptions {
  /** Prepare and type-check a TypeScript root discovered after registration. */
  prepareEntry?: RuntimeEntryPreparer;
}

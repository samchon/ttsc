import type { FilesystemPathIdentityContext } from "./FilesystemPathIdentityContext";

/**
 * A project-input identity resolver; an alias of
 * {@link FilesystemPathIdentityContext}, so project inputs and every other path
 * are compared by one rule.
 *
 * The inherited context memoizes per-key observations and is not an atomic
 * filesystem snapshot. A new project-input operation needing fresh state must
 * use a new context; the alias adds no freshness or case-policy guarantee.
 *
 * @evidence contracts/common.md#principled-implementation The alias preserves the filesystem context's resolution, case-policy and containment operations exactly, so project and other native consumers share the same relation.
 * @evidence contracts/common.md#clear-and-simple-design The domain name adds no adapter state or policy; the underlying context owns caching and native decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A type alias neither patches foreign methods nor adds test-specific native behavior.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs name the alias, shared identity rule and inherited non-atomic freshness limit, with separated acknowledgment tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The shared boundary exposes native case judgment and physical identity rather than deriving policy from the project domain or its filename.
 */
export type ProjectInputPathIdentityContext = FilesystemPathIdentityContext;

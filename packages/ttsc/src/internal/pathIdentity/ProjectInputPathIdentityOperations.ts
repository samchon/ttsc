import type { FilesystemPathIdentityOperations } from "./FilesystemPathIdentityOperations";

/**
 * The replaceable filesystem primitives of a project-input identity context; an
 * alias of {@link FilesystemPathIdentityOperations} for the same reason
 * {@link ProjectInputPathIdentity} is one.
 *
 * Partial overrides, native defaults and strict versus best-effort error policy
 * retain exactly the underlying resolver's meanings. This name adds no
 * project-specific probing or dependency-validation guarantee.
 *
 * @evidence contracts/common.md#principled-implementation The alias preserves the complete filesystem primitive and policy shape, so project inputs use the same native identity premises as other consumers rather than a second equivalence relation.
 * @evidence contracts/common.md#clear-and-simple-design A domain name is sufficient; no adapter, duplicate operations object or project-only defaults are introduced.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The alias adds no special project path handling or foreign mutation, and does not turn successful identity resolution into proof of unchanged input contents.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify the alias, inherited override/error semantics and absence of project-only validation, with separated tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Project operations inherit native alias resolution, path grammar and directory case capability from the shared boundary instead of applying an OS-based project naming rule.
 */
export type ProjectInputPathIdentityOperations =
  FilesystemPathIdentityOperations;

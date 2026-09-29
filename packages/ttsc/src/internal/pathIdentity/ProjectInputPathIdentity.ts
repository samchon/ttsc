import type { FilesystemPathIdentity } from "./FilesystemPathIdentity";

/**
 * The identity of one project input (a tsconfig, a source, a declared plugin
 * input) as the watch and LSP hosts compare them.
 *
 * It is exactly a {@link FilesystemPathIdentity}. Project inputs carry no rule
 * of their own; the alias keeps call sites that reason about project inputs
 * readable while guaranteeing they agree with every other filesystem-identity
 * consumer.
 *
 * @evidence contracts/common.md#principled-implementation The exact type alias preserves both canonical comparison key and filesystem spelling without adding project-only distinctions that would change identity.
 * @evidence contracts/common.md#clear-and-simple-design A domain alias improves caller vocabulary while the underlying representation and policy retain one owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The alias uses TypeScript's supported type identity and carries no runtime adaptation or consumer special case.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains which project inputs it names and why the representation is shared, separated from tags.
 * @evidence contracts/portability.md#os-neutral-implementation The aliased representation separates native comparison keys from returned path spellings; it does not introduce another OS or case-policy assumption.
 */
export type ProjectInputPathIdentity = FilesystemPathIdentity;

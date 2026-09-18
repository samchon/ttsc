import type { FilesystemPathIdentity } from "./FilesystemPathIdentity";

/**
 * The identity of one project input (a tsconfig, a source, a declared plugin
 * input) as the watch and LSP hosts compare them.
 *
 * It is exactly a {@link FilesystemPathIdentity}. Project inputs carry no rule
 * of their own; the alias keeps call sites that reason about project inputs
 * readable while guaranteeing they agree with every other filesystem-identity
 * consumer.
 */
export type ProjectInputPathIdentity = FilesystemPathIdentity;

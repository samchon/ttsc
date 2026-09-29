import { sourceFilePattern } from "./sourceFilePattern";
import { isDeclarationFile } from "./transform/utils/isDeclarationFile";

/** Matches any path segment that is a `node_modules` directory (cross-platform). */
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;

/**
 * Matches virtual module ids: Rollup/Vite use a leading NUL byte (`\0`) as
 * convention.
 */
const virtualModulePattern = /\0/;

/**
 * Returns `true` when the module id refers to a real TypeScript source file
 * that should be processed by the ttsc transform.
 *
 * TypeScript only. {@link sourceFilePattern} deliberately excludes JavaScript,
 * so a `.js` module reaches no adapter's transform, and this docstring used to
 * say otherwise while the pattern it is built from said the truth
 * (samchon/ttsc#1309).
 *
 * Also excluded: virtual modules (NUL prefix), `.d.ts` declaration files, and
 * anything inside `node_modules`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared extension predicate admits TypeScript source, then NUL ids,
 *   declaration basenames and complete node_modules segments are rejected.
 *   Both slash spellings belong to module-id syntax, independent of host OS.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One predicate owns adapter inclusion; declaration classification delegates
 *   to its dedicated helper instead of duplicating suffix policy per host.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   node_modules and virtual identifiers are contractual ownership boundaries,
 *   not fixture paths or consumer names.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain TypeScript-only ownership and exclusions, with
 *   descriptive prose separated from tags per documentation guidance.
 */
export function isTransformTarget(id: string): boolean {
  return (
    sourceFilePattern.test(id) &&
    !virtualModulePattern.test(id) &&
    !isDeclarationFile(id) &&
    !nodeModulesPattern.test(id)
  );
}

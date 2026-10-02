import { TtscGraphReadonly } from "../model/TtscGraphReadonly";
import { ITtscGraphNode as NodeShape } from "../structures/ITtscGraphNode";

type ITtscGraphNode = TtscGraphReadonly<NodeShape>;

/**
 * True for dependency declarations outside the authored project graph.
 *
 * @evidence contracts/common.md#principled-implementation Producer external status, bundled coordinates and node_modules path segments identify dependency boundaries in the graph's portable vocabulary.
 * @evidence contracts/common.md#clear-and-simple-design One predicate owns external selection for projections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection follows provenance and dependency coordinates rather than named repositories.
 * @evidence contracts/common.md#meaningful-documentation The native headline states dependency-boundary meaning; the predicate uses portable graph coordinates rather than native paths.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isExternalNode acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isExternalNode makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isExternalNode computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation isExternalNode operates on in-memory values and performs no filesystem, path or process operation.
 */
export function isExternalNode(node: ITtscGraphNode): boolean {
  return (
    node.external ||
    node.file.startsWith("bundled://") ||
    /(^|\/)node_modules\//.test(node.file)
  );
}

/**
 * True for a `.d.ts` declaration file. Every declaration such a file holds is
 * ambient by construction, so none of them carries a body the graph can walk
 * into, whether or not the `declare` keyword is written out.
 *
 * @evidence contracts/common.md#principled-implementation The declaration-file suffix recognizes d.ts, d.cts and d.mts ambient files under TypeScript's supported filename conventions.
 * @evidence contracts/common.md#clear-and-simple-design One suffix predicate is reused by body and support-file policies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambient status is not guessed from fixture names or missing written declare keywords.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains why ambient declarations are bodyless regardless of modifier spelling.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isDeclarationFile acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isDeclarationFile makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isDeclarationFile computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation isDeclarationFile operates on in-memory values and performs no filesystem, path or process operation.
 */
export function isDeclarationFile(file: string): boolean {
  return /\.d\.[cm]?ts$/.test(file);
}

/**
 * True for conventional tests, examples, fixtures, generated output and builds.
 *
 * This is a projection heuristic over portable graph coordinates, not proof
 * that a source is generated or a package's manifest classification.
 *
 * @evidence contracts/common.md#principled-implementation Segment and suffix conventions select likely support material; declaration-file and dependency checks share the established coordinate vocabulary.
 * @evidence contracts/common.md#clear-and-simple-design One policy combines conventional support categories for rankers rather than duplicating regexes in each runner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The heuristic uses general path categories and does not hardcode benchmark repositories or expected symbols.
 * @evidence contracts/common.md#meaningful-documentation Native prose states heuristic status and its provenance limitation rather than certifying generated source from naming.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isSupportPath acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isSupportPath makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isSupportPath computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation isSupportPath operates on in-memory values and performs no filesystem, path or process operation.
 */
export function isSupportPath(file: string): boolean {
  return (
    file === "" ||
    file.startsWith("bundled://") ||
    /(^|\/)node_modules\//.test(file) ||
    /(^|\/)(test|tests|__tests__|spec|sample|samples|fixture|fixtures|__fixtures__|example|examples)\//.test(
      file,
    ) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file) ||
    /(^|\/)typings\.[cm]?ts$/.test(file) ||
    isDeclarationFile(file) ||
    /(^|\/)(dist|build|coverage|generated|__generated__)\//.test(file)
  );
}

/**
 * True for conventional test-directory or test/spec-suffixed source paths.
 *
 * This identifies likely test anchors by path convention; it does not execute
 * tests or establish their behavioral coverage.
 *
 * @evidence contracts/common.md#principled-implementation Complete path segments and TypeScript/JavaScript test suffixes recognize conventional test locations without substring matches on arbitrary names.
 * @evidence contracts/common.md#clear-and-simple-design The test subset has one predicate separate from the broader support-file policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Returned test anchors follow general conventions rather than an expected benchmark answer list.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains conventional selection and its lack of behavioral verification.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isTestPath acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isTestPath makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isTestPath computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation isTestPath operates on in-memory values and performs no filesystem, path or process operation.
 */
export function isTestPath(file: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|spec)\//.test(file) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file)
  );
}

/**
 * True when exported symbols are unlikely to be authored public API.
 *
 * Support material, ambient typings and internal directories are selection
 * signals, not proof that a symbol cannot be imported.
 *
 * @evidence contracts/common.md#principled-implementation Shared support selection plus typings/internal conventions identify likely API noise while preserving actual compiler export facts elsewhere.
 * @evidence contracts/common.md#clear-and-simple-design The API projection adds its own two exclusions to the common support predicate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Heuristic API visibility does not rewrite the producer's actual export table.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes likely authored API from supported importability.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isPublicApiNoisePath acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isPublicApiNoisePath makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isPublicApiNoisePath computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation isPublicApiNoisePath operates on in-memory values and performs no filesystem, path or process operation.
 */
export function isPublicApiNoisePath(file: string): boolean {
  return (
    isSupportPath(file) ||
    /(^|\/|\.)typings\.[cm]?ts$/.test(file) ||
    /(^|\/)internal\//.test(file)
  );
}

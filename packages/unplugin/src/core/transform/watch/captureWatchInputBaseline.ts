import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import { captureWatchInputBaselines } from "./captureWatchInputBaselines";

/**
 * Capture a main-process baseline comparable with generation-owned evidence.
 * Two equal broad observations are required; an observed mismatch or exception
 * declines the capture. Equality does not establish an atomic snapshot or rule
 * out a transient change between reads.
 *
 * @param options.tree Whether the path was recorded as a plugin source
 *   directory, whose state the baseline then carries (samchon/ttsc#1487).
 * @param options.accessibleEntries Whether compiler listing names are needed by
 *   a recorded predicate. Unrequested listings are not enumerated.
 * @param options.nativePredicates Native version-one codec kinds requested by
 *   recorded inputs. Raw native listings are independent of compiler listings.
 * @param options.projectRoot Project whose plugin cache records prove a plugin
 *   tree, so a new process does not read its sources and SDK again
 *   (samchon/ttsc#1725).
 * @evidence contracts/common.md#principled-implementation Two independently captured codec facts must agree before a baseline is returned; equality detects observed changes but cannot establish absence of intervening unobserved changes.
 * @evidence contracts/common.md#clear-and-simple-design The singleton delegates to the batch owner, which assembles codec facts and owns independent observations and failure handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable reads retain their explicit codec markers and predicates; a mismatch or escaping exception declines capture without supplying expected state or retrying until a desired answer appears.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain capture rejection, equality limitations and optional subtree cost, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Stat, hash and identity use supplied native operations. Plugin-tree capture uses the shared native build-state owner, so an injected view must describe that same source tree.
 * @evidence contracts/performance.md#efficient-algorithms Two fixed broad captures each read B bytes once for both codecs; native identity and metadata retain their path-resolution costs. Optional plugin-tree observation scans its selected population and bytes, and listings sort E UTF-8 names with encoding and prefix-comparison costs. Unrequested trees and listings are not scanned, and fresh identity contexts avoid reusing the first capture's metadata.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Independent current observations are the purpose of capture; the caller owns subsequent baseline reuse and its validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Hash buffers and identity contexts are call-local; this capture retains no cache, native handle or task.
 */
export function captureWatchInputBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  options: {
    tree?: boolean;
    accessibleEntries?: boolean;
    nativePredicates?: readonly (keyof NonNullable<
      TtscWatchInputBaseline["nativePredicates"]
    >)[];
    projectRoot?: string;
  } = {},
): TtscWatchInputBaseline | undefined {
  return captureWatchInputBaselines([file], filesystem, options).get(file);
}

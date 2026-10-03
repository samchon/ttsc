import { RawEdge } from "./RawEdge";
import { RawNode } from "./RawNode";

/**
 * Minimal graph dump accepted by the pure viewer projection.
 *
 * @evidence contracts/common.md#principled-implementation Node and edge arrays carry the complete input population while optional project preserves legacy dump compatibility.
 * @evidence contracts/common.md#clear-and-simple-design The projection boundary omits provenance validation owned by parseDump and direct producer consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reduction does not treat this minimal structural type as proof of compiler correctness.
 * @evidence contracts/common.md#meaningful-documentation Native members explain input populations and optional project label.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface RawDump {
  /** Project locator or display label, absent on older inputs. */
  project?: string;

  /** All nodes available before viewer selection. */
  nodes: RawNode[];

  /** All directed edges before endpoint selection. */
  edges: RawEdge[];
}

import { ViewerLink } from "./ViewerLink";
import { ViewerNode } from "./ViewerNode";

/**
 * Reduced connected graph and the populations removed by its filters.
 *
 * @evidence contracts/common.md#principled-implementation Final nodes/links describe the drawn subgraph while counters retain raw totals and distinct boundary/cap omissions.
 * @evidence contracts/common.md#clear-and-simple-design One payload carries drawing inputs and explanatory totals without preserving a second full raw graph.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection losses are exposed as counters rather than hidden to imply the full project was drawn.
 * @evidence contracts/common.md#meaningful-documentation Native member comments define each count's population and distinguish selected nodes from cap/boundary removals.
 */
export interface ViewerPayload {
  /** Display project label, empty when not supplied. */
  project: string;

  /** Input/output totals and disjoint removal categories. */
  counts: {
    /** Node count before viewer filtering. */
    rawNodes: number;

    /** Edge count before viewer filtering. */
    rawEdges: number;

    /** Connected nodes in the final payload. */
    nodes: number;

    /** Edges whose rewritten endpoints both survive. */
    links: number;

    /** External nodes omitted when boundary filtering is enabled. */
    droppedExternal: number;

    /** Nonexternal ignored nodes omitted when generated filtering is enabled. */
    droppedIgnored: number;

    /**
     * Boundary-surviving nodes removed by the degree cap, before isolated-node
     * removal.
     */
    droppedByCap: number;
  };

  /** Connected display nodes. */
  nodes: ViewerNode[];

  /** Directed display edges between retained nodes. */
  links: ViewerLink[];
}

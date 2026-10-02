import { TtscGraphMemory, leadingToken } from "../model/TtscGraphMemory";
import { TtscGraphReadonly } from "../model/TtscGraphReadonly";
import { ITtscGraphDecorator } from "../structures/ITtscGraphDecorator";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
import { ITtscGraphDocTag } from "../structures/ITtscGraphDocTag";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode as NodeShape } from "../structures/ITtscGraphNode";
import { isExternalNode, isTestPath } from "./pathPolicy";
import { resolveGraphHandle } from "./resolveHandle";
import { IRunnerOutput, resultNext } from "./resultNext";

type ITtscGraphNode = TtscGraphReadonly<NodeShape>;

// A signature is the declaration head up to the body brace: a handful of lines.
const MAX_SIGNATURE_LINES = 4;
// A doc summary is one sentence; the rest of the comment is the file's to keep.
const MAX_DOC_CHARS = 200;
// A symbol's fan-out — what it calls, what names it in a type, what depends on
// it — scales with how popular it is, not with the symbol: a central type is
// named in a thousand places, and returning all of them is a hundred thousand
// tokens of "who uses this", which is a trace/impact question, not "what is
// this". So fan-out is a small default slice; identity (members, literals) is
// not, because a class's members and a union's values are the symbol itself and
// are bounded by the declaration.
const DEFAULT_NEIGHBORS = 2;
const MAX_NEIGHBORS = 3;
const DEFAULT_DEPENDENCIES = 2;
const MAX_DEPENDENCIES = 4;
// Structural relationships are navigation, not the dependency picture details is for.
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports"]);
// Kinds whose value is their member outline, not implementation text.
const CONTAINER_KINDS = new Set<ITtscGraphNode["kind"]>([
  "class",
  "interface",
  "enum",
  "file",
]);

/**
 * Resolve each handle to its declared shape: sourceSpan anchors, signature,
 * direct dependencies, and for containers, member outlines. It answers from the
 * graph's resolved structure instead of inlining implementation bodies.
 *
 * @evidence contracts/common.md#principled-implementation Resolved handles select exact node facts, complete literal/member identities and explicitly bounded relationship slices; ambiguity is returned separately.
 * @evidence contracts/common.md#clear-and-simple-design Shape, relationship and source-display helpers each own one projection while this function assembles the selected details envelope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown and ambiguous handles are not converted to guessed declarations; capped members withdraw the corresponding completeness audit.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes declared shape from implementation bodies; helper documentation explains member, reference and citation limits.
 * @evidence contracts/performance.md#efficient-algorithms Each handle uses the shared resolver, whose dotted-suffix fallback may scan V nodes; resolved relationships inspect D incident edges and retain only K ranked references in O(DK) time and O(K) temporary space, where K is at most four, while member/literal output scales with the declaration's own members.
 * @evidence contracts/performance.md#reuse-equivalent-work The graph shares generation indexes and source-line adjudications across handles and requests; this call builds fresh caller-owned projections because request limits and selected handles differ.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Detail, ambiguity and unknown arrays live for this request and transfer to its caller; no query history or native handle is retained by this operation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation reads in-memory facts; source lines arrive through graph.source, the reader that owns file access.
 */
export function runDetails(
  graph: TtscGraphMemory,
  props: ITtscGraphDetails.IRequest,
): IRunnerOutput<ITtscGraphDetails> {
  // Identity is the whole answer. The caller named this handle to learn what it
  // is, and a class's members or a union's values are the symbol itself — cut
  // them and the model reads the file for the rest, the read this index exists
  // to remove. So `memberLimit` and `literals` default to unlimited. Fan-out
  // does not: what names or uses a symbol is bounded by its popularity, not by
  // it, so those stay a small slice with `trace` for the rest.
  const memberLimit = limitOf(props.memberLimit);
  // True once any handle's member list is cut by the cap above. It travels with
  // the result so the audit can withdraw the completeness claim for exactly
  // that half — a caller cannot notice the cut from the result itself.
  let membersCapped = false;
  const neighborLimit = capOf(
    props.neighborLimit,
    DEFAULT_NEIGHBORS,
    MAX_NEIGHBORS,
  );
  const dependencyLimit = capOf(
    props.dependencyLimit,
    DEFAULT_DEPENDENCIES,
    MAX_DEPENDENCIES,
  );
  const wantNeighbors = props.neighbors === true;
  const includeExternal = props.includeExternal === true;
  const nodes: ITtscGraphDetails.INode[] = [];
  const unknown: string[] = [];
  const ambiguous: ITtscGraphDetails.IAmbiguity[] = [];
  for (const handle of props.handles) {
    const resolved = resolveGraphHandle(graph, handle);
    if (resolved.node === undefined) {
      // A handle the graph knows twice is not a handle the graph does not know.
      // Hand back the nodes it named and let the caller pick one; calling it
      // unknown sends the caller to the files for facts already in the index.
      if (resolved.candidates !== undefined && resolved.candidates.length > 0) {
        ambiguous.push({
          handle,
          candidates: resolved.candidates.map((node) => ({
            id: node.id,
            name: node.qualifiedName ?? node.name,
            kind: node.kind,
            file: node.file,
            ...(node.evidence?.startLine !== undefined
              ? { line: node.evidence.startLine }
              : {}),
          })),
        });
        continue;
      }
      unknown.push(handle);
      continue;
    }
    const node = resolved.node;
    const detail: ITtscGraphDetails.INode = {
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
    };
    if (node.evidence?.startLine) detail.line = node.evidence.startLine;
    const sig = signatureOf(graph, node);
    if (sig !== undefined) detail.signature = sig;
    const doc = docOf(graph, node);
    if (doc !== undefined) detail.doc = doc;
    const decorators = decoratorsOf(node);
    if (decorators !== undefined) detail.decorators = decorators;
    const docTags = docTagsOf(node);
    if (docTags !== undefined) detail.docTags = docTags;
    const implementation = evidenceCoordinatesOf(node.implementation);
    if (implementation !== undefined) detail.implementation = implementation;
    const span = implementation ?? evidenceCoordinatesOf(node.evidence);
    if (span !== undefined) {
      detail.sourceSpan = {
        file: span.file,
        startLine: span.startLine,
        endLine: span.endLine,
      };
    }
    const calls = dependencyRefs(
      graph,
      node,
      executionKinds,
      dependencyLimit,
      includeExternal,
    );
    if (calls.length > 0) detail.calls = calls;
    const types = dependencyRefs(
      graph,
      node,
      typeKinds,
      dependencyLimit,
      includeExternal,
    );
    if (types.length > 0) detail.types = types;
    const implementedBy = incomingDependencyRefs(
      graph,
      node,
      implementationKinds,
      dependencyLimit,
      includeExternal,
    );
    if (implementedBy.length > 0) detail.implementedBy = implementedBy;
    if (CONTAINER_KINDS.has(node.kind)) {
      // Read one past the cap so the cut is observable. Without it a full list
      // and a truncated one are the same value, and the audit went on claiming
      // the members were whole.
      const list = members(graph, node, memberLimit + 1);
      if (list.length > memberLimit) membersCapped = true;
      const shown = list.slice(0, memberLimit);
      if (shown.length > 0) detail.members = shown;
    }
    if (node.kind === "variable") {
      const list = objectLiteralMembers(node, memberLimit + 1);
      if (list.length > memberLimit) membersCapped = true;
      const shown = list.slice(0, memberLimit);
      if (shown.length > 0) detail.members = shown;
    }
    // An enum's members ride on its own node rather than on `contains` edges,
    // because they are not nodes: the outline above finds nothing for an enum
    // and always did. Its signature stops at the `{`, so without this the one
    // kind whose entire content is its member list answered with none of it.
    // Uncapped like every other identity list — the members are the enum.
    if (node.kind === "enum") {
      const list = enumMembers(node, memberLimit + 1);
      if (list.length > memberLimit) membersCapped = true;
      const shown = list.slice(0, memberLimit);
      if (shown.length > 0) detail.members = shown;
    }
    if (node.literals !== undefined && node.literals.length > 0) {
      detail.literals = [...node.literals];
    }
    if (wantNeighbors) {
      detail.dependsOn = refs(
        graph,
        graph.outgoing(node.id),
        "to",
        neighborLimit,
        includeExternal,
      );
      detail.dependedOnBy = refs(
        graph,
        graph.incoming(node.id),
        "from",
        neighborLimit,
        includeExternal,
      );
    }
    nodes.push(detail);
  }
  return {
    ...(membersCapped ? { membersCapped: true } : {}),
    result: {
      type: "details",
      nodes,
      unknown,
      ...(ambiguous.length > 0 ? { ambiguous } : {}),
    },
    next:
      nodes.length === 0 && ambiguous.length > 0
        ? resultNext(
            "inspect",
            "Each handle names several nodes; re-call details with the id of the one the question means.",
            "details",
          )
        : nodes.length === 0
          ? resultNext(
              "outside",
              "No handle resolved to a node, so the graph holds nothing for them.",
            )
          : resultNext(
              "answer",
              "The signatures, members, dependencies, and sourceSpan anchors are what the graph holds on these symbols.",
            ),
  };
}

/** The members a container owns (via `contains`), each with its own signature. */
function members(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  limit: number,
): ITtscGraphDetails.IMember[] {
  const out: ITtscGraphDetails.IMember[] = [];
  for (const edge of graph.outgoing(node.id)) {
    if (edge.kind !== "contains") continue;
    const member = graph.node(edge.to);
    if (member === undefined) continue;
    const m: ITtscGraphDetails.IMember = {
      name: member.qualifiedName ?? member.name,
      kind: member.kind,
    };
    if (member.evidence?.startLine) m.line = member.evidence.startLine;
    const sig = signatureOf(graph, member);
    if (sig !== undefined) m.signature = sig;
    const decorators = decoratorsOf(member);
    if (decorators !== undefined) m.decorators = decorators;
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * An enum's members, owner-qualified so the name reads the way the code writes
 * it, with the value each carries as its signature.
 *
 * The name is why this exists. `literals` answers what values the enum admits,
 * but a caller writes `Colors.Red` and never `"red"`, so an enum the graph
 * already held sent a caller that had named it to the file for the one fact it
 * came for (#738).
 */
function enumMembers(
  node: ITtscGraphNode,
  limit: number,
): ITtscGraphDetails.IMember[] {
  return (node.enumMembers ?? []).slice(0, limit).map((member) => ({
    name: `${node.qualifiedName ?? node.name}.${member.name}`,
    kind: "property",
    ...(member.value !== undefined
      ? { signature: `${member.name} = ${member.value}` }
      : {}),
  }));
}

function objectLiteralMembers(
  node: ITtscGraphNode,
  limit: number,
): ITtscGraphDetails.IMember[] {
  return (node.objectMembers ?? []).slice(0, limit).map((member) => ({
    name: member.name,
    kind: member.kind,
    ...(member.line !== undefined ? { line: member.line } : {}),
    ...(member.signature !== undefined ? { signature: member.signature } : {}),
  }));
}

/** Map dependency edges to references on their far endpoint, dropping structure. */
function refs(
  graph: TtscGraphMemory,
  edges: readonly ITtscGraphEdge[],
  end: "to" | "from",
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: RankedReference[] = [];
  let order = 0;
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined) continue;
    if (!includeExternal && isExternalNode(other)) continue;
    const ref: ITtscGraphDetails.IReference = {
      id: other.id,
      name: other.qualifiedName ?? other.name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const evidence = edgeEvidenceOf(edge);
    if (evidence !== undefined) ref.evidence = evidence;
    retainRanked(ranked, { ref, rank: refRank(ref, edge), order: order++ }, limit);
  }
  return ranked.map((item) => item.ref);
}

const executionKinds = new Set([
  "calls",
  "instantiates",
  "accesses",
  "renders",
]);
const typeKinds = new Set(["type_ref", "extends", "implements", "overrides"]);
const implementationKinds = new Set(["implements", "overrides"]);

function dependencyRefs(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: RankedReference[] = [];
  let order = 0;
  for (const edge of graph.outgoing(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.to);
    if (other === undefined || other.kind === "file") continue;
    if (!includeExternal && isExternalNode(other)) continue;
    const name = other.qualifiedName ?? other.name;
    const ref: ITtscGraphDetails.IReference = {
      id: other.id,
      name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const evidence = edgeEvidenceOf(edge);
    if (evidence !== undefined) ref.evidence = evidence;
    retainRanked(
      ranked,
      { ref, rank: refRank(ref, edge), order: order++ },
      limit,
      true,
    );
  }
  return ranked.map((item) => item.ref);
}

function incomingDependencyRefs(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: RankedReference[] = [];
  let order = 0;
  for (const edge of graph.incoming(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.from);
    if (other === undefined || other.kind === "file") continue;
    if (!includeExternal && isExternalNode(other)) continue;
    const ref: ITtscGraphDetails.IReference = {
      id: other.id,
      name: other.qualifiedName ?? other.name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const evidence = edgeEvidenceOf(edge);
    if (evidence !== undefined) ref.evidence = evidence;
    retainRanked(
      ranked,
      { ref, rank: refRank(ref, edge), order: order++ },
      limit,
      true,
    );
  }
  return ranked.map((item) => item.ref);
}

interface RankedReference {
  ref: ITtscGraphDetails.IReference;
  rank: number;
  order: number;
}

/** Keep the best capped references in stable score order as edges arrive. */
function retainRanked(
  ranked: RankedReference[],
  candidate: RankedReference,
  limit: number,
  deduplicate = false,
): void {
  if (deduplicate) {
    const duplicate = ranked.findIndex(
      (item) =>
        item.ref.relation === candidate.ref.relation &&
        item.ref.id === candidate.ref.id,
    );
    if (duplicate >= 0) {
      if (ranked[duplicate]!.rank <= candidate.rank) return;
      ranked.splice(duplicate, 1);
    }
  }
  const position = ranked.findIndex(
    (item) =>
      candidate.rank < item.rank ||
      (candidate.rank === item.rank && candidate.order < item.order),
  );
  if (position < 0) {
    if (ranked.length < limit) ranked.push(candidate);
    return;
  }
  if (position >= limit) return;
  ranked.splice(position, 0, candidate);
  if (ranked.length > limit) ranked.pop();
}

/**
 * An identity list's cap: none by default, honored when a caller passes one.
 * details answers a named handle's own shape in full — its members, its values
 * — so the default is unlimited; the tour passes an explicit number to embed a
 * compact slice of its own.
 */
function limitOf(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value)
    ? Infinity
    : Math.max(1, Math.floor(value));
}

/**
 * A fan-out list's cap: a small default, clamped to a ceiling. What names or
 * uses a symbol grows with its popularity, not with the symbol, so the whole
 * list is a trace/impact answer and details returns an orientation slice.
 */
function capOf(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  const n = value === undefined || !Number.isFinite(value) ? fallback : value;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

/**
 * Which references a capped list keeps.
 *
 * Kind leads: what a symbol calls says more about it than what it names in a
 * type position. Within a kind the source order decides, which is a stable
 * tiebreak and nothing more — so a symbol with two hundred callers used to
 * answer with whichever two happened to be written nearest the top of their
 * file, and for Excalidraw's `mutateElement` those two were a sort test and a
 * duplication test. A test is not who runs the code in production, and the tour
 * already carries the tests it found in a section of their own, so a reference
 * from a test file ranks below every reference from the code under test.
 */
function refRank(
  ref: ITtscGraphDetails.IReference,
  edge: ITtscGraphEdge,
): number {
  return (
    (isTestPath(ref.file) ? 1 : 0) * 10_000_000 +
    edgeKindRank(edge.kind) * 100_000 +
    evidenceRank(edge) +
    (ref.file.startsWith("bundled://") ? 20_000 : 0)
  );
}

function evidenceRank(edge: ITtscGraphEdge): number {
  const line = edge.evidence?.startLine ?? 9_999;
  const col = edge.evidence?.startCol ?? 999;
  return line * 100 + col;
}

function edgeKindRank(kind: string): number {
  switch (kind) {
    case "calls":
      return 0;
    case "instantiates":
      return 1;
    case "accesses":
    case "renders":
      return 2;
    case "overrides":
      return 3;
    case "extends":
    case "implements":
      return 4;
    case "type_ref":
      return 5;
    default:
      return 10;
  }
}

/**
 * Decorator facts already captured on a node, omitted when absent or empty.
 *
 * @evidence contracts/common.md#principled-implementation The adapter preserves collected decorator order and values while omitting an empty optional facet.
 * @evidence contracts/common.md#clear-and-simple-design One accessor shares decorator projection across details, lookup and tour consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No framework-specific reinterpretation changes the collected decorator facts.
 * @evidence contracts/common.md#meaningful-documentation The native headline states collected-fact and empty-facet behavior before the tags.
 * @evidence contracts/performance.md#efficient-algorithms One pass copies each decorator and its arguments, costing their total population without scanning unrelated graph nodes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This caller-owned projection performs no cross-request coordination; the graph owns the shared source facts.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned array transfers to its caller and this helper retains no state or handle.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation copies in-memory node fields; no file, path or process.
 */
export function decoratorsOf(
  node: ITtscGraphNode,
): ITtscGraphDecorator[] | undefined {
  return node.decorators !== undefined && node.decorators.length > 0
    ? node.decorators.map((decorator) => ({
        name: decorator.name,
        arguments: decorator.arguments.map((argument) => ({ ...argument })),
      }))
    : undefined;
}

/**
 * The declaration's documentation tags, with each text elided at the same
 * length a doc summary is, optionally narrowed to the ones a caller matched.
 *
 * The text is a reason written for a human reader, so the same budget applies:
 * enough to judge what the declaration claims, not the whole paragraph. What
 * the budget may never reach is the address the text opens with, which is a
 * hit's explanation of why it is in the result; {@link elideTagText} keeps it.
 *
 * The optional filter narrows to the tags a caller matched. It runs on the
 * node's own tags, before any elision, so a tag found by an address longer than
 * the budget is still recognized as the one that matched.
 *
 * @evidence contracts/common.md#principled-implementation Filtering original tags before eliding preserves matching addresses; the shared leading-token rule keeps whole citation prefixes intact.
 * @evidence contracts/common.md#clear-and-simple-design One projection helper owns tag selection and display elision for every graph result consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Address matches are not re-evaluated against truncated text and long addresses are never cut into another target.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain the display budget, protected address and filter-before-elision ordering.
 * @evidence contracts/performance.md#efficient-algorithms Filtering and mapping visit the node's tags once each; elision examines the leading address and copies at most the needed display prefix.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Selection depends on a caller predicate and returns a fresh mutable projection; this helper coordinates no reusable result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selected and returned arrays are request-local and no historical tags are retained here.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation copies and elides in-memory tag text; no file, path or process.
 */
export function docTagsOf(
  node: ITtscGraphNode,
  keep?: (tag: TtscGraphReadonly<ITtscGraphDocTag>) => boolean,
): ITtscGraphDocTag[] | undefined {
  if (node.docTags === undefined || node.docTags.length === 0) return undefined;
  const selected =
    keep === undefined ? node.docTags : node.docTags.filter(keep);
  if (selected.length === 0) return undefined;
  return selected.map((tag) =>
    tag.text !== undefined && tag.text.length > MAX_DOC_CHARS
      ? { ...tag, text: elideTagText(tag.text) }
      : { ...tag },
  );
}

/**
 * Cut a tag text to the doc budget without cutting the address it opens with.
 *
 * The protected prefix is whatever the index calls the address, taken from the
 * same function the reverse lookup keys on, so the two cannot disagree about
 * where it ends: a braced link holds spaces inside its group, and measuring the
 * prefix to the first whitespace instead would return `{@link` and cut the rest
 * of the group away.
 *
 * A text that is nothing but an over-long address comes back whole, with no
 * marker — an ellipsis on text that was never cut says something false about
 * the one field a caller reads to know whether to go on reading.
 */
function elideTagText(text: string): string {
  const address = leadingToken(text)?.length ?? 0;
  const keep = Math.max(MAX_DOC_CHARS, address);
  if (keep >= text.length) return text;
  return text.slice(0, keep).trimEnd() + "…";
}

/**
 * Relationship evidence as public coordinates, omitted when absent.
 *
 * @evidence contracts/common.md#principled-implementation Copying the actual edge span preserves file and optional endpoints without inferring missing coordinates.
 * @evidence contracts/common.md#clear-and-simple-design One coordinate mapper is shared by graph runners and node implementation evidence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing source evidence stays absent rather than being replaced with the caller's declaration span.
 * @evidence contracts/common.md#meaningful-documentation The native headline explains public-coordinate projection and absent evidence behavior.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Copying a fixed set of optional coordinates chooses no input-dependent processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This fixed-size projection coordinates no cross-request computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned value transfers to its caller without a retained handle or cache.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation copies span coordinates of an in-memory edge; no file, path or process.
 */
export function edgeEvidenceOf(
  edge: ITtscGraphEdge,
): ITtscGraphEvidence | undefined {
  return evidenceCoordinatesOf(edge.evidence);
}

function evidenceCoordinatesOf(
  evidence: ITtscGraphEvidence | undefined,
): ITtscGraphEvidence | undefined {
  if (evidence === undefined) return undefined;
  return {
    file: evidence.file,
    startLine: evidence.startLine,
    ...(evidence.startCol !== undefined ? { startCol: evidence.startCol } : {}),
    ...(evidence.endLine !== undefined ? { endLine: evidence.endLine } : {}),
    ...(evidence.endCol !== undefined ? { endCol: evidence.endCol } : {}),
  };
}

/**
 * What the declaration says it is: the first sentence of the doc comment
 * written above it.
 *
 * A tour hands back names, edges, spans, and signatures, and a model given them
 * still opens the files — "let me read the actual source at the key hops to
 * build a concrete narrative" — because a name and an arrow do not say what a
 * symbol is for, and a tour is a narrative. The project already wrote that
 * sentence above the declaration, and the compiler carries it. It is the
 * declaration's documentation, not the body of the work: an index that lists a
 * symbol with what it is for is doing an index's job.
 *
 * @evidence contracts/common.md#principled-implementation Provenance-gated lines are scanned immediately above the declaration for JSDoc prose, stopping before tags and returning its first sentence.
 * @evidence contracts/common.md#clear-and-simple-design This helper owns a short documentation projection; the source reader owns immutable generation validation and caching.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing or mismatched source yields absence rather than an inferred purpose from names or implementation text.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain first-sentence purpose and distinguish declaration prose from implementation bodies.
 * @evidence contracts/performance.md#efficient-algorithms The source reader supplies indexed, cached lines; this helper scans only the adjacent comment and joins its prose, costing the comment's lines and characters.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Source-byte validation and line splitting are shared by the reader; this pure projection does not coordinate a separate result cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Comment and prose arrays are local to this call and no history or handle is retained.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation reads lines through graph.source, the reader that owns file access, and adds none of its own.
 */
export function docOf(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): string | undefined {
  const evidence = node.evidence;
  const lines =
    evidence === undefined ? undefined : graph.source.lines(evidence.file);
  if (lines === undefined || evidence === undefined) return undefined;
  let index = evidence.startLine - 2;
  while (index >= 0 && (lines[index] ?? "").trim() === "") index--;
  if (index < 0 || !(lines[index] ?? "").trim().endsWith("*/"))
    return undefined;
  const block: string[] = [];
  for (; index >= 0; index--) {
    const line = (lines[index] ?? "").trim();
    block.unshift(line);
    if (line.startsWith("/**")) break;
    if (line.startsWith("/*")) return undefined;
  }
  if (index < 0) return undefined;
  const prose: string[] = [];
  for (const line of block) {
    const text = line
      .replace(/^\/\*\*+/, "")
      .replace(/\*\/$/, "")
      .replace(/^\*+ ?/, "")
      .trim();
    if (text.startsWith("@")) break;
    if (text !== "") prose.push(text);
  }
  const joined = prose.join(" ").trim();
  if (joined === "") return undefined;
  const stop = joined.search(/\.(\s|$)/);
  const sentence = stop > 0 ? joined.slice(0, stop + 1) : joined;
  return sentence.length > MAX_DOC_CHARS
    ? sentence.slice(0, MAX_DOC_CHARS).trimEnd() + "…"
    : sentence;
}

/**
 * The producer's compiler-bounded declaration head, limited to display lines.
 *
 * Without a producer signature, return undefined. Physical lines cannot
 * establish where a declaration head ends: a body may share its line and a
 * parameter or return type may itself contain braces. The source span remains
 * available when a caller needs to read the declaration.
 *
 * @evidence contracts/common.md#principled-implementation Only the AST-bounded producer head establishes a declaration-only signature; limiting its lines preserves that established boundary.
 * @evidence contracts/common.md#clear-and-simple-design The producer owns declaration syntax boundaries and this helper owns display length, with no second partial TypeScript parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing heads are not repaired by a line-scan heuristic that can leak implementation or neighboring declarations.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the producer requirement, missing-head absence and source-span escape path.
 * @evidence contracts/performance.md#efficient-algorithms Splitting the producer head and selecting its first display lines costs the supplied signature's length; no source file or graph traversal occurs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The producer head is already shared on the graph node, while this display projection coordinates no repeated work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The capped text is caller-owned and this helper retains no cache or native resource.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation cuts the producer's signature text to a few lines; no file, path or process.
 */
export function signatureOf(
  _graph: TtscGraphMemory,
  node: ITtscGraphNode,
): string | undefined {
  if (node.signature !== undefined && node.signature !== "") {
    const capped = node.signature.split("\n").slice(0, MAX_SIGNATURE_LINES);
    const head = capped.join("\n").trim();
    if (head !== "") return head;
  }
  return undefined;
}

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDecorator } from "../structures/ITtscGraphDecorator";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { isExternalNode, isTestPath } from "./pathPolicy";
import { resolveGraphHandle } from "./resolveHandle";
import { IRunnerOutput, resultNext } from "./resultNext";

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
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);
// Kinds whose value is their member outline, not implementation text.
const CONTAINER_KINDS = new Set<string>([
  "class",
  "interface",
  "namespace",
  "module",
  "enum",
  "file",
]);

/**
 * Resolve each handle to its declared shape: sourceSpan anchors, signature,
 * direct dependencies, and for containers, member outlines. It answers from the
 * graph's resolved structure instead of inlining implementation bodies.
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
      detail.literals = node.literals;
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
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
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
    ranked.push({ ref, rank: refRank(ref, edge) });
  }
  // Ranked so a caller that does throttle (the tour) keeps the strongest refs,
  // not the ones nearest the top of a file. Uncapped, `limit` is Infinity and
  // the sort is just a stable order.
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.map((item) => item.ref).slice(0, limit);
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
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
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
    ranked.push({
      ref,
      rank: refRank(ref, edge),
    });
  }
  return rankedRefs(ranked, limit);
}

function incomingDependencyRefs(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
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
    ranked.push({
      ref,
      rank: refRank(ref, edge),
    });
  }
  return rankedRefs(ranked, limit);
}

/** Sort by rank, drop duplicate (relation, id) pairs, and cut to `limit`. */
function rankedRefs(
  ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }>,
  limit: number,
): ITtscGraphDetails.IReference[] {
  ranked.sort((a, b) => a.rank - b.rank);
  const out: ITtscGraphDetails.IReference[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    const key = `${item.ref.relation}:${item.ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.ref);
    if (out.length >= limit) break;
  }
  return out;
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
    case "tests":
      return 3;
    case "overrides":
    case "decorates":
      return 4;
    case "extends":
    case "implements":
      return 5;
    case "type_ref":
      return 6;
    default:
      return 10;
  }
}

/** Decorator facts already captured on a node, omitted when absent. */
export function decoratorsOf(
  node: ITtscGraphNode,
): ITtscGraphDecorator[] | undefined {
  return node.decorators !== undefined && node.decorators.length > 0
    ? node.decorators
    : undefined;
}

/** Relationship evidence as public coordinates, omitted when absent. */
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
 * The declaration signature: the head of the declaration up to and including
 * the line that opens its body (`{`), or the single declaration line when there
 * is no brace, capped so a wrapped signature cannot run away.
 *
 * It never runs past the declaration's own span. The stop used to be the brace,
 * the trailing semicolon, or the line cap, and a declaration ending in none of
 * them read its neighbors instead: an enum member ends in a comma, so `VIEW`
 * came back as itself plus the two members after it and the closing brace. The
 * span is the fact that says where the declaration ends, and it was already on
 * the node.
 */
export function signatureOf(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): string | undefined {
  // The producer cuts the head where the compiler says the body opens, so when
  // it supplied one there is nothing left to infer. The scan below only runs
  // where it could not: it reads whole physical lines and stops at the first one
  // holding a `{`, which leaks implementation text when a declaration shares its
  // line with its body and stops early when the head itself contains a brace.
  if (node.signature !== undefined && node.signature !== "") {
    const capped = node.signature.split("\n").slice(0, MAX_SIGNATURE_LINES);
    const head = capped.join("\n").trim();
    if (head !== "") return head;
  }
  const evidence = node.evidence;
  const lines =
    evidence === undefined ? undefined : graph.source.lines(evidence.file);
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const last =
    evidence.endLine === undefined
      ? lines.length - 1
      : Math.min(lines.length - 1, evidence.endLine - 1);
  const out: string[] = [];
  for (let i = start; i <= last && out.length < MAX_SIGNATURE_LINES; i++) {
    const line = lines[i];
    if (line === undefined) break;
    out.push(line);
    if (line.includes("{") || line.trimEnd().endsWith(";")) break;
  }
  const text = out.join("\n").trim();
  return text === "" ? undefined : text;
}

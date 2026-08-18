import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphSpan } from "../structures/ITtscGraphSpan";
import { TtscGraphEdgeKind } from "../structures/TtscGraphEdgeKind";
import { ttscGraphNodeIdPath } from "./TtscGraphNodeId";
import { TtscGraphSourceReader } from "./TtscGraphSourceReader";

/**
 * The in-memory resident graph the MCP tools answer from.
 *
 * It loads one `ttscgraph dump` — the checker-resolved fact graph — then
 * synthesizes the structural relationships the dump deliberately leaves to this
 * layer: `file` container nodes and the `contains` ownership tree, plus the
 * refinement of a class-member `variable` to a `property`. Export and member
 * implementation relationships are checker facts already present in the dump.
 * Every tool call is then a lookup or traversal over the indexes built here;
 * nothing recompiles.
 */
export class TtscGraphMemory {
  private readonly byId: Map<string, ITtscGraphNode>;
  private readonly outEdges: Map<string, ITtscGraphEdge[]>;
  private readonly inEdges: Map<string, ITtscGraphEdge[]>;
  private readonly byNameIndex: Map<string, ITtscGraphNode[]>;
  private readonly bySymbolIndex: Map<string, ITtscGraphNode[]>;
  private readonly byDocTagTarget: Map<string, ITtscGraphNode[]>;

  /** The absolute project root the dump was built for. */
  readonly project: string;
  /** Every post-fold node, including refined properties and file containers. */
  readonly nodes: readonly ITtscGraphNode[];
  /** Every edge, raw plus synthesized containment. */
  readonly edges: readonly ITtscGraphEdge[];
  /** Provenance-gated source display facts cached for this exact snapshot. */
  readonly source: TtscGraphSourceReader;

  private constructor(
    project: string,
    nodes: ITtscGraphNode[],
    edges: ITtscGraphEdge[],
    provenance: ITtscGraphDump.IProvenance,
  ) {
    this.project = project;
    this.nodes = nodes;
    this.edges = edges;
    this.source = new TtscGraphSourceReader(project, provenance);

    this.byId = new Map(nodes.map((n) => [n.id, n]));
    this.byNameIndex = new Map();
    this.bySymbolIndex = new Map();
    this.byDocTagTarget = new Map();
    for (const node of nodes) {
      const bucket = this.byNameIndex.get(node.name);
      if (bucket) bucket.push(node);
      else this.byNameIndex.set(node.name, [node]);
      if (node.kind !== "file") {
        push(this.bySymbolIndex, node.name, node);
        if (node.qualifiedName !== undefined) {
          push(this.bySymbolIndex, node.qualifiedName, node);
        }
      }
      for (const target of docTagTargetsOf(node)) {
        const carriers = this.byDocTagTarget.get(target);
        if (carriers === undefined) this.byDocTagTarget.set(target, [node]);
        else if (!carriers.includes(node)) carriers.push(node);
      }
    }
    this.outEdges = new Map();
    this.inEdges = new Map();
    for (const edge of edges) {
      push(this.outEdges, edge.from, edge);
      push(this.inEdges, edge.to, edge);
    }
  }

  /** Build a model from a parsed dump, synthesizing structural relationships. */
  static from(dump: ITtscGraphDump): TtscGraphMemory {
    const { nodes, edges } = synthesize(dump);
    return new TtscGraphMemory(dump.project, nodes, edges, dump.provenance);
  }

  /** The node with this id, or undefined. */
  node(id: string): ITtscGraphNode | undefined {
    return this.byId.get(id);
  }

  /** Edges leaving a node (the node is the `from`). */
  outgoing(id: string): readonly ITtscGraphEdge[] {
    return this.outEdges.get(id) ?? [];
  }

  /** Edges entering a node (the node is the `to`). */
  incoming(id: string): readonly ITtscGraphEdge[] {
    return this.inEdges.get(id) ?? [];
  }

  /** Every node whose simple name equals `name`. */
  named(name: string): readonly ITtscGraphNode[] {
    return this.byNameIndex.get(name) ?? [];
  }

  /** Every non-file node whose simple or owner-qualified symbol handle matches. */
  symbols(handle: string): readonly ITtscGraphNode[] {
    return this.bySymbolIndex.get(handle) ?? [];
  }

  /** Every workspace node on its module's export surface. */
  exported(): ITtscGraphNode[] {
    return this.nodes.filter((n) => n.exported && !n.external);
  }

  /**
   * Every declaration whose documentation carries a tag whose text opens with
   * this token — the reverse of the citation question.
   *
   * The forward direction costs a reader one file: the tag sits above the
   * declaration they already found. The reverse direction is what an index is
   * for, because the declarations implementing one specification are scattered
   * across every file that implements it, and finding them otherwise means
   * searching the whole repository.
   *
   * The token is a selection rule rather than a producer fact. Which part of a
   * tag's text names a thing belongs to whatever convention wrote the tag, so
   * the index treats the leading whitespace-delimited token as the candidate
   * and lets the ranked operations judge — which is the layer whose audit
   * already declares its selection heuristic.
   */
  citing(target: string): readonly ITtscGraphNode[] {
    return this.byDocTagTarget.get(target) ?? [];
  }
}

/**
 * The address each of a node's documentation tags names, deduplicated.
 *
 * A braced inline link is one token including its braces (`{@link ISale}`),
 * because that is how the author wrote the target and how a reader searching
 * for it will spell it. Splitting on whitespace alone would key it under
 * `{@link`, which is every link in the project.
 */
function docTagTargetsOf(node: ITtscGraphNode): string[] {
  if (node.docTags === undefined) return [];
  const targets: string[] = [];
  for (const tag of node.docTags) {
    const token = documentationTarget(tag.text);
    if (token !== undefined && !targets.includes(token)) targets.push(token);
  }
  return targets;
}

/**
 * The address a documentation tag's text opens with, or undefined when its
 * first token is ordinary prose.
 *
 * Every unrecognized tag arrives here, and most of them are not citations:
 * TypeScript has no AST kind for `@remarks`, `@example`, `@todo`, `@internal`,
 * or `@default` either, so their first word reaches this function exactly as a
 * citation target does. Indexing those turned `@todo Add caching here` into a
 * carrier of the address `Add`, and a query opening with that word answered
 * with it — above every real name match, and labelled a certain citation.
 *
 * So a token qualifies only when it carries a separator that prose does not: a
 * path or anchor (`docs/pricing.md#sale`), a namespaced or method-prefixed
 * address (`POST:/orders`, `prisma:Sale`), an inline link, or a URL. An English
 * word carries none of these, and neither does a bare number, so `@default 4`
 * and `@todo Add caching` index nothing while every address form in use does.
 *
 * This is a selection rule, not a claim about the source. It lives here rather
 * than in the producer for that reason: the graph reports the tag as written
 * and this decides only what the ranked operations will match on, which is the
 * layer whose audit already declares its selection heuristic. A convention
 * whose addresses look like prose is simply not indexed; nothing is lost from
 * the tag itself, which `details` still returns in full.
 */
export function documentationTarget(
  text: string | undefined,
): string | undefined {
  const token = leadingToken(text);
  if (token === undefined) return undefined;
  if (token.startsWith("{")) return token;
  // A separator anywhere but the last position: a trailing one is sentence
  // punctuation ("Uses the cache." ends in a dot and names nothing), while an
  // interior one is what every address form spells.
  return /[/#:][^\s]/u.test(token) || /\.[^\s.]/u.test(token)
    ? token
    : undefined;
}

/** The first whitespace-delimited token, or the whole brace group it opens. */
export function leadingToken(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (trimmed === undefined || trimmed === "") return undefined;
  if (trimmed.startsWith("{")) {
    const close = trimmed.indexOf("}");
    if (close > 0) return trimmed.slice(0, close + 1);
  }
  const stop = trimmed.search(/\s/u);
  return stop < 0 ? trimmed : trimmed.slice(0, stop);
}

/** Append value to the slice stored at key, creating the slice on first use. */
function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/**
 * The within-file identity of a node: its owner-qualified name when it has one
 * (`Class.method`), else its simple name. Two nodes in one file never share a
 * key, so it is the handle the ownership synthesis looks owners up by.
 */
function keyOf(node: ITtscGraphNode): string {
  return node.qualifiedName ?? node.name;
}

/**
 * The owner key derived from facts the producer serialized separately.
 *
 * A quoted member named `"a.b"` has Name `a.b` and QualifiedName `Box.a.b`.
 * Cutting the qualified name at its last dot invents owner `Box.a`; removing
 * the exact `.${name}` suffix instead preserves the producer's real boundary.
 */
function ownerKey(node: ITtscGraphNode): string | undefined {
  if (node.qualifiedName === undefined || node.qualifiedName === node.name)
    return undefined;
  const suffix = `.${node.name}`;
  if (!node.qualifiedName.endsWith(suffix)) return undefined;
  const owner = node.qualifiedName.slice(0, -suffix.length);
  return owner === "" ? undefined : owner;
}

/** A file's id and node name from its dump path coordinate. */
function fileNodeId(file: string): string {
  return file;
}

/**
 * A wire span with its file put back: the one the builder left out because the
 * reader has it, or the one it kept because it could not be derived (an
 * implementation in another file).
 */
function spanIn(span: ITtscGraphSpan, file: string): ITtscGraphEvidence {
  return { ...span, file: span.file ?? file };
}

/**
 * The source file a node id names. An id is `path#Qualified.Name:kind`, and a
 * file node's id is the path itself.
 */
function fileOfNodeId(id: string): string {
  return ttscGraphNodeIdPath(id) ?? id;
}

function basename(file: string): string {
  const slash = file.lastIndexOf("/");
  return slash >= 0 ? file.slice(slash + 1) : file;
}

/**
 * Derive the structural layer from a dump's faithful facts: refine class-member
 * variables to properties, add a `file` node per workspace source, connect the
 * `contains` ownership tree, and re-anchor compiler-owned `exports` edges.
 */
function synthesize(dump: ITtscGraphDump): {
  nodes: ITtscGraphNode[];
  edges: ITtscGraphEdge[];
} {
  // A module node is the dump's name for a source file's export surface, and a
  // file node is this layer's name for the same file. Fold the two: the module
  // keeps its file present here even when the file declares nothing (a barrel),
  // and its `exports` edges are re-anchored on the file id every other tool
  // already traverses. What the module carried, the file now carries.
  const moduleFiles = new Set(
    dump.nodes.filter((n) => n.kind === "module").map((n) => n.file),
  );
  const moduleIds = new Map(
    dump.nodes.filter((n) => n.kind === "module").map((n) => [n.id, n.file]),
  );
  // Clone nodes so property refinement does not mutate the caller's dump, and
  // put back the file the builder left out of every span: a node's span is in
  // the node's file, an edge's span is in the file its `from` id names. The
  // builder omits both because they are exactly reconstructible and they are not
  // small — the two copies are 17% of the document, 55 MB of VS Code's 323 MB,
  // paid again in the encode, the pipe, the parse and the validation. Nothing
  // downstream of this line sees a span without its file.
  const nodes: ITtscGraphNode[] = dump.nodes.flatMap((n): ITtscGraphNode[] => {
    if (n.kind === "module") return [];
    const { evidence, implementation, ...rest } = n;
    return [
      {
        ...rest,
        kind: n.kind,
        ...(evidence !== undefined
          ? { evidence: spanIn(evidence, n.file) }
          : {}),
        ...(implementation !== undefined
          ? { implementation: spanIn(implementation, n.file) }
          : {}),
      },
    ];
  });
  const edges: ITtscGraphEdge[] = dump.edges.map((edge) => {
    const { evidence, ...rest } = edge;
    const from = moduleIds.get(edge.from);
    return {
      ...rest,
      ...(from !== undefined ? { from: fileNodeId(from) } : {}),
      ...(evidence !== undefined
        ? { evidence: spanIn(evidence, fileOfNodeId(edge.from)) }
        : {}),
    };
  });

  // Index workspace nodes by (file, within-file key) so ownership can resolve a
  // member to its declaring class/namespace.
  const byFileKey = new Map<string, ITtscGraphNode>();
  for (const node of nodes) {
    if (!node.external) byFileKey.set(node.file + "\0" + keyOf(node), node);
  }
  const owner = (node: ITtscGraphNode): ITtscGraphNode | undefined => {
    const parent = ownerKey(node);
    if (parent === undefined) return undefined;
    return byFileKey.get(node.file + "\0" + parent);
  };

  // Refine: a `variable` whose owner is a class or interface is a property.
  for (const node of nodes) {
    if (node.kind !== "variable" || node.external) continue;
    const parent = owner(node);
    if (parent && (parent.kind === "class" || parent.kind === "interface")) {
      node.kind = "property";
    }
  }

  // One file container node per distinct workspace source file, plus every file
  // the dump saw an export surface on — a barrel declares nothing, so its only
  // trace in the dump is its module node, and it is exactly the file a consumer
  // imports the package from.
  const fileNodes = new Map<string, ITtscGraphNode>();
  const addFileNode = (file: string): void => {
    if (file === "" || fileNodes.has(file)) return;
    fileNodes.set(file, {
      id: fileNodeId(file),
      kind: "file",
      name: basename(file),
      file,
      external: false,
    });
  };
  for (const node of nodes) {
    if (node.external) continue;
    addFileNode(node.file);
  }
  for (const file of moduleFiles) addFileNode(file);

  // Ownership: a member is contained by its owner; a top-level declaration by
  // its file. Exports are not synthesized here: the dump's `exports` edges come
  // from the checker's export table, which follows re-exports and barrels, so
  // they say which module puts a symbol on the wire. Deriving them from the
  // `exported` flag instead would say only that the declaring file made it
  // public, which is the fact that cannot tell a package's front door from its
  // legacy subpath.
  const structural: ITtscGraphEdge[] = [];
  for (const node of nodes) {
    if (node.external || node.file === "") continue;
    const parent = owner(node);
    const container = parent ? parent.id : fileNodeId(node.file);
    structural.push({
      from: container,
      to: node.id,
      kind: "contains",
    });
  }

  return {
    nodes: [...nodes, ...fileNodes.values()],
    edges: [...edges, ...structural],
  };
}

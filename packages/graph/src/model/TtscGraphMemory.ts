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

  /** The absolute project root the dump was built for. */
  readonly project: string;
  /** Every node, raw plus synthesized (file containers). */
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

/** A file's id and node name from its project-relative path. */
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
  const nodes: ITtscGraphNode[] = dump.nodes
    .filter((n) => n.kind !== "module")
    .map((n) => {
      const { evidence, implementation, ...rest } = n;
      return {
        ...rest,
        ...(evidence !== undefined
          ? { evidence: spanIn(evidence, n.file) }
          : {}),
        ...(implementation !== undefined
          ? { implementation: spanIn(implementation, n.file) }
          : {}),
      };
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

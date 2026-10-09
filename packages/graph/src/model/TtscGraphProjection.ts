import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphSpan } from "../structures/ITtscGraphSpan";
import { isArtifactNodeKind } from "../structures/TtscGraphArtifactNodeKind";
import { ttscGraphNodeIdPath } from "./TtscGraphNodeId";
import { TtscGraphReadonly } from "./TtscGraphReadonly";
import { copyGraphSnapshot } from "./copyGraphSnapshot";

/**
 * Immutable structural projection components for validated resident facts.
 *
 * Node refinement and containment depend on all declarations in the same file;
 * export reanchoring depends on the source node's module declaration. Grouping
 * both raw nodes and source-owned edges by that file captures these
 * dependencies, including metadata/artifact nodes sharing it. Global metadata
 * invalidates all components, and complete generation order is reconstructed
 * independently.
 *
 * @evidence contracts/common.md#principled-implementation Frozen raw reference sequences prove unchanged component inputs; all same-file declarations and source edges participate, so lexical collisions, module folding and artifact parents cannot borrow stale derived facts.
 * @evidence contracts/common.md#clear-and-simple-design Full synthesis remains one implementation used by cold construction and invalidated components; create owns dependency partitioning and immutable component reuse.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The store still validates the complete generation first. No content witness, owner or raw edge is skipped to obtain reuse, and public DTOs are never frozen by borrowing.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains actual synthesis dependencies, metadata invalidation and generation ordering rather than claiming universally delta-only work.
 * @evidence contracts/performance.md#efficient-algorithms Grouping and generation ordering scan all raw references. Only changed file components synthesize outer records and detach/freeze nested facts once; metadata changes rebuild all. Reference arrays/maps remain linear in generation size.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal frozen node/edge sequences and equal project/config/producer/capability/universe metadata retain the component. Cross-file edge changes invalidate their owning component; target absence remains a store validation error.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Returned state retains only current file components and generation arrays; deleted components are omitted and no previous State reference is stored.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation In-memory fact coordinates and reference identity select reuse; no native filesystem or process operation runs here.
 */
export namespace TtscGraphProjection {
  /**
   * Current projection and the inputs qualifying each immutable component.
   *
   * @evidence contracts/common.md#principled-implementation The metadata witness and complete raw reference sequences distinguish reusable components from invalidated ones; generation arrays preserve global order.
   * @evidence contracts/common.md#clear-and-simple-design One current state groups dependency witnesses and projected output; it contains no previous-state link.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Component validity is established by create after store validation rather than assumed from a file name.
   * @evidence contracts/common.md#meaningful-documentation The headline describes the dependency witness; member comments distinguish its coordinates and ordered outputs.
   * @evidenceExclude contracts/performance.md#efficient-algorithms State describes data; create owns scanning and synthesis.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work State carries witnesses; create decides whether they qualify reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources State owns no lifecycle operation; its model and session control lifetime.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation In-memory data only, without native coordinates being opened or resolved.
   */
  export interface State {
    /** Project, build-universe and producer authority for these components. */
    readonly metadata: string;

    /** Complete same-file synthesis inputs and their projected immutable facts. */
    readonly components: ReadonlyMap<string, Component>;

    /** Non-module declarations followed by file containers in full-model order. */
    readonly nodes: readonly TtscGraphReadonly<ITtscGraphNode>[];

    /** Original relation order followed by synthesized ownership relations. */
    readonly edges: readonly TtscGraphReadonly<ITtscGraphEdge>[];
  }

  /**
   * Detach a caller's full dump before exposing synthesized immutable facts.
   *
   * Synthesis borrows nested facts synchronously and changes only new outer
   * records. Final recursive copying detaches those facts before freezing or
   * exposing the result, for mutable callers and frozen resident inputs alike.
   *
   * @evidence contracts/common.md#principled-implementation Readonly borrowed synthesis inputs preserve caller ownership; only fresh outer records change, and final recursive copying isolates every nested record before freezing and publication.
   * @evidence contracts/common.md#clear-and-simple-design Cold models and invalidated components use the same synthesis implementation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native export relations remain authoritative and no caller-owned DTO is frozen in place.
   * @evidence contracts/common.md#meaningful-documentation Native prose states caller ownership, synchronous borrowing, construction-local changes and the final immutable publication boundary.
   * @evidence contracts/performance.md#efficient-algorithms Synthesis scans facts and indexes owner handles; only colliding handles require candidate scans. One final recursive copy costs the selected fact population's nested bytes, without an intermediate mutable DTO copy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation constructs a supplied population; create selects components requiring construction.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned frozen facts transfer to the model/component owner; no historical state is retained here.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation In-memory synthesis and copying perform no native operations.
   */
  export function full(
    dump: TtscGraphReadonly<Pick<ITtscGraphDump, "nodes" | "edges">>,
  ) {
    return copyGraphSnapshot(synthesize(dump));
  }

  /**
   * Reuse only components with the same complete synthesis input sequence.
   *
   * The caller supplies store-owned frozen facts after complete validation.
   * Same-file declarations determine lexical owners and module anchors; source
   * edges belong to that same component. Output ordering remains
   * generation-wide.
   *
   * @evidence contracts/common.md#principled-implementation Complete ordered raw inputs and global metadata qualify each component. Synthesis dependencies are local to a node's file, while cross-file edge target existence has already been validated by the store.
   * @evidence contracts/common.md#clear-and-simple-design Partitioning, component selection and global output ordering are separate stages; full owns the shared synthesis implementation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Every raw node and source edge participates; no ownership, provenance or manifest validation is skipped and no native relation is invented.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the frozen-input premise and why same-file declarations and source edges form the dependency boundary.
   * @evidence contracts/performance.md#efficient-algorithms Linear reference grouping/equality and generation ordering remain necessary. Invalidated components borrow nested inputs during synthesis and detach/freeze once at full's publication boundary, with temporary maps/arrays proportional to current facts.
   * @evidence contracts/performance.md#reuse-equivalent-work Exact raw reference sequences plus project/config/schema/capability/producer/universe metadata retain equivalent components. Changed owner declarations or source relations invalidate the whole dependent file component.
   * @evidence contracts/performance.md#bound-retention-and-release-resources New state retains only current components and output arrays; deleted components disappear and no previous state is linked.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Fact coordinates select in-memory groups; no filesystem or process operation interprets them.
   */
  export function create(
    dump: TtscGraphReadonly<ITtscGraphDump>,
    previous?: State,
  ): State {
    const metadata = JSON.stringify({
      project: dump.project,
      tsconfig: dump.tsconfig,
      schemaVersion: dump.provenance.schemaVersion,
      capabilities: dump.provenance.capabilities,
      producer: dump.provenance.producer,
      artifactProducer: dump.provenance.artifactProducer,
      universe: dump.provenance.universe,
    });
    const inputs = new Map<string, { nodes: RawNode[]; edges: RawEdge[] }>();
    const files = new Map<string, string>();
    for (const node of dump.nodes) {
      let input = inputs.get(node.file);
      if (input === undefined) {
        input = { nodes: [], edges: [] };
        inputs.set(node.file, input);
      }
      input.nodes.push(node);
      files.set(node.id, node.file);
    }
    for (const edge of dump.edges)
      inputs.get(files.get(edge.from)!)!.edges.push(edge);
    const components = new Map<string, Component>();
    for (const [file, input] of inputs) {
      const old =
        metadata === previous?.metadata
          ? previous.components.get(file)
          : undefined;
      if (
        old !== undefined &&
        same(input.nodes, old.rawNodes) &&
        same(input.edges, old.rawEdges)
      ) {
        components.set(file, old);
        continue;
      }
      const projected = full(input);
      const count = input.nodes.filter((node) => node.kind !== "module").length;
      components.set(file, {
        rawNodes: Object.freeze(input.nodes),
        rawEdges: Object.freeze(input.edges),
        nodes: new Map(
          projected.nodes.slice(0, count).map((node) => [node.id, node]),
        ),
        file: projected.nodes[count],
        edges: new Map(
          input.edges.map((edge, index) => [edge, projected.edges[index]!]),
        ),
        structural: new Map(
          projected.edges
            .slice(input.edges.length)
            .map((edge) => [edge.to, edge]),
        ),
      });
    }
    const nodes: TtscGraphReadonly<ITtscGraphNode>[] = [];
    const structural: TtscGraphReadonly<ITtscGraphEdge>[] = [];
    const containers = new Set<string>();
    for (const node of dump.nodes) {
      if (node.kind === "module") continue;
      const component = components.get(node.file)!;
      nodes.push(component.nodes.get(node.id)!);
      const edge = component.structural.get(node.id);
      if (edge !== undefined) structural.push(edge);
      if (!node.external && !isArtifactNodeKind(node.kind) && node.file !== "")
        containers.add(node.file);
    }
    for (const node of dump.nodes)
      if (node.kind === "module" && node.file !== "") containers.add(node.file);
    for (const file of containers) nodes.push(components.get(file)!.file!);
    const edges = dump.edges.map(
      (edge) => components.get(files.get(edge.from)!)!.edges.get(edge)!,
    );
    for (const edge of structural) edges.push(edge);
    return Object.freeze({
      metadata,
      components,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
    });
  }
}

type RawNode = TtscGraphReadonly<ITtscGraphDump.INode>;
type RawEdge = TtscGraphReadonly<ITtscGraphDump.IEdge>;
/** Fresh outer node whose borrowed nested facts stay readonly until detachment. */
type SynthesizedNode = Omit<TtscGraphReadonly<ITtscGraphNode>, "kind"> & {
  kind: ITtscGraphNode["kind"];
};
/** One file's complete immutable raw dependencies and derived output. */
interface Component {
  readonly rawNodes: readonly RawNode[];
  readonly rawEdges: readonly RawEdge[];
  readonly nodes: ReadonlyMap<string, TtscGraphReadonly<ITtscGraphNode>>;
  readonly file: TtscGraphReadonly<ITtscGraphNode> | undefined;
  readonly edges: ReadonlyMap<RawEdge, TtscGraphReadonly<ITtscGraphEdge>>;
  readonly structural: ReadonlyMap<string, TtscGraphReadonly<ITtscGraphEdge>>;
}

/** Reference order is part of synthesis and query result identity. */
function same<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/** Append to a construction-local bucket; published outputs are frozen later. */
function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/**
 * The within-file identity of a node: its owner-qualified name when it has one
 * (`Class.method`), else its simple name. Merged declarations can share this
 * handle; declaration ranges disambiguate their member ownership.
 */
function keyOf(node: TtscGraphReadonly<ITtscGraphNode>): string {
  return node.qualifiedName ?? node.name;
}

/**
 * The owner key derived from facts the producer serialized separately.
 *
 * A quoted member named `"a.b"` has Name `a.b` and QualifiedName `Box.a.b`.
 * Cutting the qualified name at its last dot invents owner `Box.a`; removing
 * the exact `.${name}` suffix instead preserves the producer's real boundary.
 * Object keys containing dots, brackets or no characters carry a JSON bracket
 * suffix, keeping their identity distinct from nested object ownership.
 */
function ownerKey(node: TtscGraphReadonly<ITtscGraphNode>): string | undefined {
  if (node.qualifiedName === undefined || node.qualifiedName === node.name)
    return undefined;
  const suffix = `.${node.name}`;
  let owner: string | undefined;
  if (node.qualifiedName.endsWith(suffix)) {
    owner = node.qualifiedName.slice(0, -suffix.length);
  } else if (node.qualifiedName.endsWith('"]')) {
    // The native producer brackets reserved/empty object keys using JSON. Find
    // the opening string quote without treating an escaped quote inside the
    // key as a boundary; JSON decoding accepts equivalent Unicode escapes.
    const qualified = node.qualifiedName;
    for (let index = qualified.length - 3; index > 0; index--) {
      if (qualified[index] !== '"') continue;
      let escapes = 0;
      for (
        let before = index - 1;
        before >= 0 && qualified[before] === "\\";
        before--
      )
        escapes++;
      if (escapes % 2 !== 0) continue;
      if (qualified[index - 1] !== "[") break;
      try {
        if (JSON.parse(qualified.slice(index, -1)) === node.name)
          owner = qualified.slice(0, index - 1);
      } catch {
        // A malformed qualified coordinate proves no owner.
      }
      break;
    }
  }
  return owner === "" ? undefined : owner;
}

/** Prove lexical ownership using complete same-file declaration coordinates. */
function enclosesDeclaration(
  owner: TtscGraphReadonly<ITtscGraphNode>,
  member: TtscGraphReadonly<ITtscGraphNode>,
): boolean {
  const outer = owner.evidence;
  const inner = member.evidence;
  if (
    outer === undefined ||
    inner === undefined ||
    outer.file !== inner.file ||
    outer.startCol === undefined ||
    outer.endLine === undefined ||
    outer.endCol === undefined ||
    inner.startCol === undefined ||
    inner.endLine === undefined ||
    inner.endCol === undefined
  )
    return false;
  return (
    (outer.startLine < inner.startLine ||
      (outer.startLine === inner.startLine &&
        outer.startCol <= inner.startCol)) &&
    (outer.endLine > inner.endLine ||
      (outer.endLine === inner.endLine && outer.endCol >= inner.endCol))
  );
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
function spanIn(
  span: TtscGraphReadonly<ITtscGraphSpan>,
  file: string,
): ITtscGraphEvidence {
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
function synthesize(
  dump: TtscGraphReadonly<Pick<ITtscGraphDump, "nodes" | "edges">>,
): {
  nodes: TtscGraphReadonly<ITtscGraphNode>[];
  edges: TtscGraphReadonly<ITtscGraphEdge>[];
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
  // Create outer nodes so property refinement does not mutate the caller's dump, and
  // put back the file the builder left out of every span: a node's span is in
  // the node's file, an edge's span is in the file its `from` id names. The
  // builder omits both because they are exactly reconstructible and they are not
  // small — the two copies are 17% of the document, 55 MB of VS Code's 323 MB,
  // paid again in the encode, the pipe, the parse and the validation. Nothing
  // downstream of this line sees a span without its file.
  const nodes: SynthesizedNode[] = dump.nodes.flatMap((n): SynthesizedNode[] => {
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
  const edges: TtscGraphReadonly<ITtscGraphEdge>[] = dump.edges.map((edge) => {
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
  const byFileKey = new Map<string, SynthesizedNode[]>();
  for (const node of nodes) {
    if (!node.external) push(byFileKey, node.file + "\0" + keyOf(node), node);
  }
  const owners = new Map<SynthesizedNode, SynthesizedNode | undefined>();
  const owner = (node: SynthesizedNode): SynthesizedNode | undefined => {
    if (owners.has(node)) return owners.get(node);
    const parent = ownerKey(node);
    const candidates =
      parent === undefined
        ? undefined
        : byFileKey.get(node.file + "\0" + parent);
    // A unique checker handle also owns merged namespace members outside its
    // primary declaration span. Only a colliding handle needs lexical evidence.
    // Ambiguous or incomplete ranges prove no declaration owner; retain file
    // containment rather than assigning an arbitrary merged declaration.
    const enclosing =
      candidates?.length === 1
        ? candidates
        : candidates?.filter((candidate) =>
            enclosesDeclaration(candidate, node),
          );
    const selected = enclosing?.length === 1 ? enclosing[0] : undefined;
    owners.set(node, selected);
    return selected;
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
    if (node.external || isArtifactNodeKind(node.kind)) continue;
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
    // An artifact is contained by the artifact its producer named, and by
    // nothing when that producer named none. It is never contained by a `file`
    // node: a document is already its own node, a Prisma address carries no
    // path on purpose, and an API operation has no file at all.
    if (isArtifactNodeKind(node.kind)) {
      if (node.parent !== undefined && node.parent !== "")
        structural.push({ from: node.parent, to: node.id, kind: "contains" });
      continue;
    }
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

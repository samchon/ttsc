import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphSpan } from "../structures/ITtscGraphSpan";
import { isArtifactNodeKind } from "../structures/TtscGraphArtifactNodeKind";
import { TtscGraphEdgeKind } from "../structures/TtscGraphEdgeKind";
import { ttscGraphNodeIdPath } from "./TtscGraphNodeId";
import { type TtscGraphReadonly } from "./TtscGraphReadonly";
import { TtscGraphSourceReader } from "./TtscGraphSourceReader";
import { copyGraphSnapshot } from "./copyGraphSnapshot";

type SnapshotNode = TtscGraphReadonly<ITtscGraphNode>;
type SnapshotEdge = TtscGraphReadonly<ITtscGraphEdge>;

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
 *
 * Snapshot records are owned copies and recursively frozen. Borrowed node
 * records and edge buckets have recursively readonly types, so caller changes
 * cannot invalidate generation-keyed indexes and caches.
 *
 * @evidence contracts/common.md#principled-implementation Native facts are preserved while module/file folding, exact owner suffixes and artifact parents synthesize only this layer's structural relationships.
 * @evidence contracts/common.md#clear-and-simple-design One snapshot owns node, name, relation and citation indexes; individual accessors expose that shared model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Export surfaces remain checker relationships rather than guessed from local export flags or fixture paths.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish compiler facts from synthesized structure, and accessors explain lookup and absence semantics.
 * @evidenceExclude contracts/performance.md#efficient-algorithms from owns index construction and its private synthesis/constructor helpers; this class declaration describes the resulting representation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work from establishes one shared generation; the declaration does not independently coordinate requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources from transfers generation storage to its caller; session/caller release owns its duration rather than this declaration.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation an in-memory index over parsed facts; the source reader it owns is the only file reader.
 */
export class TtscGraphMemory {
  private readonly byId: Map<string, SnapshotNode>;
  private readonly outEdges: Map<string, SnapshotEdge[]>;
  private readonly inEdges: Map<string, SnapshotEdge[]>;
  private readonly byNameIndex: Map<string, SnapshotNode[]>;
  private readonly bySymbolIndex: Map<string, SnapshotNode[]>;
  private readonly byDocTagTarget: Map<string, SnapshotNode[]>;

  /** The absolute project root the dump was built for. */
  readonly project: string;

  /** Every post-fold node, including refined properties and file containers. */
  readonly nodes: readonly SnapshotNode[];

  /** Every edge, raw plus synthesized containment. */
  readonly edges: readonly SnapshotEdge[];

  /** Provenance-gated source display facts cached for this exact snapshot. */
  readonly source: TtscGraphSourceReader;

  private constructor(
    project: string,
    nodes: readonly SnapshotNode[],
    edges: readonly SnapshotEdge[],
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
        if (
          node.qualifiedName !== undefined &&
          node.qualifiedName !== node.name
        ) {
          push(this.bySymbolIndex, node.qualifiedName, node);
        }
      }
      for (const target of docTagTargetsOf(node)) {
        const carriers = this.byDocTagTarget.get(target);
        if (carriers === undefined) this.byDocTagTarget.set(target, [node]);
        else carriers.push(node);
      }
    }
    this.outEdges = new Map();
    this.inEdges = new Map();
    for (const edge of edges) {
      push(this.outEdges, edge.from, edge);
      push(this.inEdges, edge.to, edge);
    }
    for (const buckets of [
      this.byNameIndex,
      this.bySymbolIndex,
      this.byDocTagTarget,
    ])
      for (const bucket of buckets.values()) Object.freeze(bucket);
    for (const buckets of [this.outEdges, this.inEdges])
      for (const bucket of buckets.values()) Object.freeze(bucket);
    Object.freeze(this);
  }

  /**
   * Build a model from a parsed dump, synthesizing structural relationships.
   *
   * The parsed dump must describe one valid generation. Node records are copied
   * before member-kind refinement so the caller's dump is unchanged.
   *
   * @evidence contracts/common.md#principled-implementation Synthesis reanchors native module exports and derives containment from exact owner handles and disambiguating declaration ranges before constructing the indexes for that generation.
   * @evidence contracts/common.md#clear-and-simple-design Synthesis owns representation changes; the private constructor owns index construction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No export edges are guessed from flags, and artifact ownership follows its producer rather than TypeScript id heuristics.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the valid-generation precondition and caller-dump preservation.
   * @evidence contracts/performance.md#efficient-algorithms Synthesis indexes nodes by file and handle, scanning only colliding owner buckets once per member; owned snapshot copying and index construction scan nodes, edges and facets; per-node target sets make citation deduplication linear in tag population without repeatedly scanning carrier buckets.
   * @evidence contracts/performance.md#reuse-equivalent-work One model builds all indexes once over owned frozen facts and buckets, so external mutation cannot invalidate shared generation identity.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The model retains node/edge arrays, lookup indexes and source cache proportional to its generation; the session or direct caller releases the whole model when no longer needed.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation builds indexes from a parsed dump object and reads no file; source text goes through TtscGraphSourceReader.
   */
  static from(dump: ITtscGraphDump): TtscGraphMemory {
    const { nodes, edges } = copyGraphSnapshot(synthesize(dump));
    return new TtscGraphMemory(dump.project, nodes, edges, dump.provenance);
  }

  /**
   * The node with this exact stable id, or undefined when absent.
   *
   * @evidence contracts/common.md#principled-implementation The id index returns the snapshot's exact node without conflating same-named declarations.
   * @evidence contracts/common.md#clear-and-simple-design This accessor delegates identity lookup to the single model index.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing identities are not replaced by name-matched candidates.
   * @evidence contracts/common.md#meaningful-documentation The native headline states exact-id and missing-result semantics.
   * @evidence contracts/performance.md#efficient-algorithms Exact identity requires one construction-time map lookup and no node scan.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor borrows a completed id index; from owns shared construction.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returning an existing node acquires no handle or independent retained entry.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation one Map lookup over in-memory facts.
   */
  node(id: string): SnapshotNode | undefined {
    return this.byId.get(id);
  }

  /**
   * Edges leaving a node (the node is the from endpoint), empty when absent.
   *
   * @evidence contracts/common.md#principled-implementation The outgoing index preserves native and synthesized edge direction for the exact node id.
   * @evidence contracts/common.md#clear-and-simple-design The accessor exposes one readonly bucket without rescanning the edge population.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Absence returns no edges rather than inferred calls from matching names.
   * @evidence contracts/common.md#meaningful-documentation Native prose states endpoint direction, missing behavior and the readonly return contract.
   * @evidence contracts/performance.md#efficient-algorithms A map lookup returns the outgoing bucket without traversing unrelated edges.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work from owns the reused adjacency computation; the accessor only borrows its result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Existing buckets remain generation-owned; the accessor acquires no separate resource.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation one Map lookup over in-memory edges.
   */
  outgoing(id: string): readonly SnapshotEdge[] {
    return this.outEdges.get(id) ?? [];
  }

  /**
   * Edges entering a node (the node is the to endpoint), empty when absent.
   *
   * @evidence contracts/common.md#principled-implementation The incoming index selects edges by their original target identity.
   * @evidence contracts/common.md#clear-and-simple-design The accessor shares construction-time adjacency instead of implementing another traversal.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No callers are guessed from text or substituted when the bucket is absent.
   * @evidence contracts/common.md#meaningful-documentation Native prose states incoming direction and empty absence before the tags.
   * @evidence contracts/performance.md#efficient-algorithms A map lookup returns the incoming bucket without scanning graph edges.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor borrows the index already shared by from rather than coordinating another producer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It retains no state beyond the generation's existing edge bucket.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation one Map lookup over in-memory edges.
   */
  incoming(id: string): readonly SnapshotEdge[] {
    return this.inEdges.get(id) ?? [];
  }

  /**
   * Every node whose simple name equals name, empty when absent.
   *
   * @evidence contracts/common.md#principled-implementation The exact simple-name index returns all matching identities, preserving ambiguity.
   * @evidence contracts/common.md#clear-and-simple-design A readonly bucket supplies name lookup independently of ranked search.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Multiple declarations remain candidates rather than selecting the expected fixture's declaration.
   * @evidence contracts/common.md#meaningful-documentation Native prose describes exact matching and empty absence.
   * @evidence contracts/performance.md#efficient-algorithms Exact-name lookup performs one map access instead of filtering all nodes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Name-index construction and validity belong to from, not this borrowed bucket lookup.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned bucket remains generation-owned with no separately retained cache or handle.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation one Map lookup over in-memory facts.
   */
  named(name: string): readonly SnapshotNode[] {
    return this.byNameIndex.get(name) ?? [];
  }

  /**
   * Every non-file node whose simple or owner-qualified symbol handle matches.
   *
   * Matches borrow a frozen generation-owned bucket; no match returns an empty
   * readonly list, and several matches remain distinct.
   *
   * @evidence contracts/common.md#principled-implementation The symbol index includes simple and qualified handles but excludes file containers from symbol resolution.
   * @evidence contracts/common.md#clear-and-simple-design One shared index serves all exact-handle consumers without duplicate resolution policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The accessor preserves ambiguity rather than fabricating a unique resolution.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains non-file selection, qualified handles and multiple/missing matches.
   * @evidence contracts/performance.md#efficient-algorithms Both simple and qualified handles use the construction-time symbol index, so this accessor performs one map lookup without scanning candidates.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This borrows one already-built symbol bucket; model construction owns shared work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Existing candidates remain frozen generation-owned records in a borrowed bucket; the accessor acquires no separate resource or retained entry.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation one Map lookup over in-memory facts.
   */
  symbols(handle: string): readonly SnapshotNode[] {
    return this.bySymbolIndex.get(handle) ?? [];
  }

  /**
   * Every workspace node marked exported by the native declaration facts.
   *
   * External declarations are omitted. Module-specific re-export membership is
   * available separately through exports edges.
   *
   * @evidence contracts/common.md#principled-implementation Filtering exported flags and excluding external nodes yields local exported declarations, not a guessed package front door.
   * @evidence contracts/common.md#clear-and-simple-design The accessor performs one explicit population filter; per-module surface remains in relation indexes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The API does not equate declaring-file export flags with all barrel export relationships.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes exported declarations from module-specific re-exports and states external omission.
   * @evidence contracts/performance.md#efficient-algorithms One O(V) filter over generation nodes selects exported nonexternal declarations; no separate export-flag index is built.
   * @evidence contracts/performance.md#reuse-equivalent-work Completed exported-list memoization is not implemented; every call returns a new mutable array over the shared generation nodes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The projected array belongs to its caller; this method retains no separate state.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation filters the in-memory node array; no file, path or process.
   */
  exported(): SnapshotNode[] {
    return this.nodes.filter((n) => n.exported && !n.external);
  }

  /**
   * Every declaration whose documentation names this address — the reverse of
   * the citation question.
   *
   * The forward direction costs a reader one file: the tag sits above the
   * declaration they already found. The reverse direction is what an index is
   * for, because the declarations implementing one specification are scattered
   * across every file that implements it, and finding them otherwise means
   * searching the whole repository.
   *
   * The address is exact and is spelled as {@link documentationTarget} decides,
   * so a caller passes that function's output rather than a raw query. Which
   * part of a tag's text names a thing belongs to whatever convention wrote the
   * tag, so this is a selection rule of the consuming layer rather than a fact
   * the producer claims.
   *
   * @evidence contracts/common.md#principled-implementation Exact target lookup returns indexed declaration carriers under documentationTarget's explicit consumer-side selection rule.
   * @evidence contracts/common.md#clear-and-simple-design The reverse citation index is built once alongside node indexes instead of rescanning tags per query.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A match identifies a written citation, not a coverage or truth verdict about its target.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain reverse lookup, exact spelling and the consumer heuristic's authority boundary.
   * @evidence contracts/performance.md#efficient-algorithms Reverse citation lookup uses the constructed target index instead of scanning all tags per request.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor borrows the shared citation index; from owns synthesis and its validity key.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It returns an existing readonly carrier list and acquires no resource or historical cache.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation one Map lookup over in-memory facts.
   */
  citing(target: string): readonly SnapshotNode[] {
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
function docTagTargetsOf(node: SnapshotNode): string[] {
  if (node.docTags === undefined) return [];
  const targets = new Set<string>();
  for (const tag of node.docTags) {
    const token = documentationTarget(tag.text);
    if (token !== undefined) targets.add(token);
  }
  return [...targets];
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
 *
 * @evidence contracts/common.md#principled-implementation Leading-token extraction plus interior separators selects address-like tokens while rejecting ordinary prose; this is explicitly a lookup heuristic.
 * @evidence contracts/common.md#clear-and-simple-design One selector owns citation indexing and query normalization, leaving raw tags unchanged in declaration facts.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Address punctuation is a general convention boundary rather than an allowlist of expected specifications.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state false-prose matches, accepted address forms and the limitation for prose-like conventions.
 * @evidence contracts/performance.md#efficient-algorithms Leading-token extraction and address classification scan only the tag text, with no graph-wide lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure token classifier has no completed-work coordinator; from builds the reusable citation index.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The optional returned string owns no native resource or retained history.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation tokenizes a tag string; the address it returns is text that is never resolved or opened.
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

/**
 * The first whitespace-delimited token, or the whole brace group it opens.
 *
 * An unclosed brace group is not a token: `{@link ISale` with the brace
 * forgotten would otherwise fall through to the whitespace split and index the
 * address `{@link`, which every link in the project shares.
 *
 * @evidence contracts/common.md#principled-implementation Trim and first whitespace preserve the opening token; a leading brace group is returned whole only when closed.
 * @evidence contracts/common.md#clear-and-simple-design This lexical helper is shared by citation selection rather than parsing tag semantics itself.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed brace groups return absence instead of being coerced into a ubiquitous partial link.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains brace grouping and the malformed-token reason before acknowledgment tags.
 * @evidence contracts/performance.md#efficient-algorithms A single bounded text scan finds the token boundary without constructing a parser or scanning unrelated tags.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure per-string extraction does not coordinate reusable producer work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned token survives the call; no retained map or handle is acquired.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation splits a string at whitespace or a brace group; the token is never resolved or opened.
 */
export function leadingToken(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (trimmed === undefined || trimmed === "") return undefined;
  if (trimmed.startsWith("{")) {
    const close = trimmed.indexOf("}");
    return close > 0 ? trimmed.slice(0, close + 1) : undefined;
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
 * (`Class.method`), else its simple name. Merged declarations can share this
 * handle; declaration ranges disambiguate their member ownership.
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
 * Object keys containing dots, brackets or no characters carry a JSON bracket
 * suffix, keeping their identity distinct from nested object ownership.
 */
function ownerKey(node: ITtscGraphNode): string | undefined {
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
      for (let before = index - 1; before >= 0 && qualified[before] === "\\"; before--)
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
  owner: ITtscGraphNode,
  member: ITtscGraphNode,
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
  const byFileKey = new Map<string, ITtscGraphNode[]>();
  for (const node of nodes) {
    if (!node.external) push(byFileKey, node.file + "\0" + keyOf(node), node);
  }
  const owners = new Map<ITtscGraphNode, ITtscGraphNode | undefined>();
  const owner = (node: ITtscGraphNode): ITtscGraphNode | undefined => {
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

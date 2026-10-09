import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { TtscGraphEdgeKind } from "../structures/TtscGraphEdgeKind";
import { TtscGraphProjection } from "./TtscGraphProjection";
import { type TtscGraphReadonly } from "./TtscGraphReadonly";
import { TtscGraphSourceReader } from "./TtscGraphSourceReader";

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
 * @evidenceExclude contracts/performance.md#efficient-algorithms from and fromResident own projection/index construction through their private helpers; this class declaration describes the resulting representation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work from and fromResident establish each shared generation; the declaration does not independently coordinate requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources from and fromResident transfer generation storage to their caller; session/caller release owns its duration rather than this declaration.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation an in-memory index over parsed facts; the source reader it owns is the only file reader.
 */
export class TtscGraphMemory {
  private readonly nodeKeys: Map<
    SnapshotNode,
    { symbols: readonly string[]; targets: readonly string[] }
  >;

  private readonly byId: Map<string, SnapshotNode>;
  private readonly outEdges: Map<string, readonly SnapshotEdge[]>;
  private readonly inEdges: Map<string, readonly SnapshotEdge[]>;
  private readonly byNameIndex: Map<string, readonly SnapshotNode[]>;
  private readonly bySymbolIndex: Map<string, readonly SnapshotNode[]>;
  private readonly byDocTagTarget: Map<string, readonly SnapshotNode[]>;

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
    provenance:
      | ITtscGraphDump.IProvenance
      | TtscGraphReadonly<ITtscGraphDump.IProvenance>
      | undefined,
    private readonly projection?: TtscGraphProjection.State,
    previous?: TtscGraphMemory,
  ) {
    this.project = project;
    this.nodes = nodes;
    this.edges = edges;
    // Source adjudication belongs to this generation even when graph facts
    // remain equivalent. Never transfer cached lines or cached absence.
    this.source = new TtscGraphSourceReader(
      project,
      provenance === undefined
        ? undefined
        : {
            capabilities: [...provenance.capabilities],
            sources: provenance.sources.map((source) => ({ ...source })),
          },
    );
    this.byId = new Map(nodes.map((node) => [node.id, node]));
    this.nodeKeys = new Map();
    for (const node of nodes) {
      const retained = previous?.nodeKeys.get(node);
      this.nodeKeys.set(
        node,
        retained ?? {
          symbols:
            node.kind === "file"
              ? []
              : node.qualifiedName !== undefined &&
                  node.qualifiedName !== node.name
                ? [node.name, node.qualifiedName]
                : [node.name],
          targets: docTagTargetsOf(node),
        },
      );
    }
    this.byNameIndex = index(nodes, (node) => node.name, previous?.byNameIndex);
    this.bySymbolIndex = index(
      nodes,
      (node) => this.nodeKeys.get(node)!.symbols,
      previous?.bySymbolIndex,
    );
    this.byDocTagTarget = index(
      nodes,
      (node) => this.nodeKeys.get(node)!.targets,
      previous?.byDocTagTarget,
    );
    this.outEdges = index(edges, (edge) => edge.from, previous?.outEdges);
    this.inEdges = index(edges, (edge) => edge.to, previous?.inEdges);
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
    const { nodes, edges } = TtscGraphProjection.full(dump);
    return new TtscGraphMemory(dump.project, nodes, edges, dump.provenance);
  }

  /**
   * Project validated frozen resident facts while retaining equivalent work.
   *
   * The shard store invokes this before committing its staged generation. Each
   * model owns new index maps and a new source reader; unchanged facts and
   * ordered index buckets may be shared with the previous immutable model.
   *
   * @evidence contracts/common.md#principled-implementation Validated frozen fact identity and complete projection dependencies qualify component reuse; construction never mutates the preceding model.
   * @evidence contracts/common.md#clear-and-simple-design The projection owner handles synthesis components and this model owns ordered query indexes and source authority.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This internal path requires the store's complete validation; public from still detaches caller DTOs and no graph facts or validation are omitted.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the validated-input premise, staged commit and per-generation source-reader boundary.
   * @evidence contracts/performance.md#efficient-algorithms Projection scans references and rebuilds only invalidated components; index scans retain equal buckets without allocating their arrays, while maps and generation arrays remain linear in facts.
   * @evidence contracts/performance.md#reuse-equivalent-work Same-file owner/module dependencies and metadata qualify immutable components; exact ordered reference equality qualifies node/relation/citation buckets. New source adjudication is intentionally independent.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each model retains only its current components, facts, indexes and source reader; unchanged values may also belong to retained old models, without a link retaining prior model generations.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Processes only frozen in-memory facts; source IO remains with the per-generation reader.
   */
  static fromResident(
    dump: TtscGraphReadonly<ITtscGraphDump>,
    previous?: TtscGraphMemory,
  ): TtscGraphMemory {
    const projection = TtscGraphProjection.create(dump, previous?.projection);
    return new TtscGraphMemory(
      dump.project,
      projection.nodes,
      projection.edges,
      dump.provenance,
      projection,
      previous,
    );
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

/**
 * Build an ordered index, copying a bucket only after its membership differs.
 *
 * The scan compares reference identity at each position with the previous
 * immutable bucket. Prefixes are copied only on the first difference; a
 * shortened bucket is copied at the end. New maps never mutate old maps or
 * frozen buckets. Cost is linear in memberships plus changed bucket sizes;
 * current counts/maps are temporary and no historical index is retained.
 */
function index<T>(
  values: readonly T[],
  keys: (value: T) => string | readonly string[],
  previous?: ReadonlyMap<string, readonly T[]>,
): Map<string, readonly T[]> {
  const result = new Map<string, readonly T[]>();
  const counts = new Map<string, number>();
  const append = (key: string, value: T): void => {
    const count = counts.get(key) ?? 0;
    let bucket = result.get(key);
    if (bucket === undefined) {
      bucket = previous?.get(key) ?? [];
      result.set(key, bucket);
    }
    if (bucket === previous?.get(key)) {
      if (bucket[count] !== value) {
        bucket = [...bucket.slice(0, count), value];
        result.set(key, bucket);
      }
    } else (bucket as T[]).push(value);
    counts.set(key, count + 1);
  };
  for (const value of values) {
    const selected = keys(value);
    if (typeof selected === "string") append(selected, value);
    else {
      for (const key of selected) append(key, value);
    }
  }
  for (const [key, bucket] of result) {
    const count = counts.get(key)!;
    if (bucket === previous?.get(key) && bucket.length !== count)
      result.set(key, Object.freeze(bucket.slice(0, count)));
    else if (bucket !== previous?.get(key)) Object.freeze(bucket);
  }
  return result;
}

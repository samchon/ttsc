import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEntrypoints } from "../structures/ITtscGraphEntrypoints";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNext } from "../structures/ITtscGraphNext";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTour } from "../structures/ITtscGraphTour";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { exportFanIn, hasExportSurface } from "./exportSurface";
import { isSupportPath, isTestPath } from "./pathPolicy";
import { resolveGraphHandle } from "./resolveHandle";
import { IRunnerOutput, resultNext } from "./resultNext";
import { decoratorsOf, docOf, runDetails, signatureOf } from "./runDetails";
import { runEntrypoints } from "./runEntrypoints";
import { runTrace } from "./runTrace";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 5;
/**
 * The share of a tour's seeds the symbols the caller named may take.
 *
 * Two authorities pick a tour, and neither is allowed to be the only one. Half
 * the seeds go to what the caller says the answer is made of — it has read the
 * question and the codebase's docs, and the tour has read neither. The other
 * half goes to what the graph says is central to the question, and the names do
 * not touch that ranking, because a caller cannot name what it does not know is
 * there: Opus named ten symbols along RxJS's subscribe path, and `operate` —
 * the head of the operator chain the question asked about, and the second seed
 * of the same tour with no names at all — fell out of the tour it did not
 * name.
 */
const NAMED_SHARE = 0.5;
const FLOW_SEEDS = 4;
/** How many ranked seeds deep to look for flows that actually move. */
const FLOW_SEED_CANDIDATES = 4;
const TEST_SEEDS = 3;
const MAX_FLOW_ANCHORS = 8;
const MAX_NEARBY = 10;
const MAX_TESTS = 8;
const MAX_READ_NEXT = 14;
// A public entry stands several hops above the code that does the work: an app
// factory calls a mount, which calls a renderer, which calls the patch. Three
// hops stopped at that boundary, and the model finished the chain by hand —
// "the tour stopped short of the actual patch engine", then four more calls.
// The flow reaches the work now.
// Two flows that land in the same places are one flow. Above this share of a
// candidate's reached set already told, it is a synonym of a flow the tour has.
const FLOW_OVERLAP = 0.6;
const TOUR_TRACE_MAX_DEPTH = 6;
const TOUR_TRACE_MAX_NODES = 18;
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);
const EXECUTION_KINDS = new Set<string>([
  "calls",
  "instantiates",
  "accesses",
  "renders",
]);
const TOUR_SEED_KINDS = new Set<string>([
  "class",
  "function",
  "method",
  "property",
  "variable",
  "module",
  "namespace",
  "enum",
]);

/**
 * Compose a repository-orientation/code-tour answer surface from existing graph
 * operations. It returns selected symbols, flows, nearby edges, test anchors,
 * and answer anchors without reading or embedding source bodies.
 */
export function runTour(
  graph: TtscGraphMemory,
  props: ITtscGraphTour.IRequest,
  question: string,
): IRunnerOutput<ITtscGraphTour> {
  const query = question.trim();
  const named = namedNodesOf(graph, props.reinterpretations);
  // The words that rank the tour are the caller's names, never the question's
  // prose. Which words in a question are its keywords is the caller's judgement
  // to make -- it read the question -- and the server used to make it instead,
  // with a list of sixty-eight words it happened to think were filler.
  const terms = queryTermsOf(graph, props.reinterpretations);
  const limit = bound(props.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const entry = runEntrypoints(graph, {
    type: "entrypoints",
    query,
    limit,
    neighbors: 1,
  }).result;
  const seeds = tourSeedsOf(graph, entry, query, limit, named, terms);
  const seedIds = seeds.map((node) => node.id);
  const entrypoints = seeds.map((node) => graphNodeOf(graph, node));

  // A flow that goes nowhere is a wasted slot: a seed can match the question by
  // name and still drive nothing (a decorator factory, a metadata helper), and
  // tracing the top five seeds blind spent the tour's flows on them — the model
  // read "the tour didn't surface the request pipeline" and went to the files.
  // Walk the ranked seeds instead, keeping the ones whose trace actually moves,
  // until the tour has its flows.
  // A flow the tour already told is not a second flow. zod's four public parse
  // entries — parse, parseAsync, safeParse, safeParseAsync — run the same chain
  // into the same internals, and the tour spent all four of its slots saying it
  // four times: 18 KB of payload, three quarters of it a repeat, and the rest of
  // the library (schema construction, checks, error formatting) unmentioned. A
  // candidate whose trace lands where a kept flow already landed is a synonym,
  // so keep the first and walk on to one that tells something else.
  const primaryFlow: ITtscGraphTour.IFlow[] = [];
  const told: Set<string>[] = [];

  for (const id of flowSeedIdsOf(
    tourSeedsOf(
      graph,
      entry,
      query,
      limit * FLOW_SEED_CANDIDATES,
      named,
      terms,
    ),
  )) {
    if (primaryFlow.length >= FLOW_SEEDS) break;
    const trace = runTrace(graph, {
      type: "trace",
      from: id,
      direction: "forward",
      focus: "execution",
      maxDepth: TOUR_TRACE_MAX_DEPTH,
      maxNodes: TOUR_TRACE_MAX_NODES,
    }).result;
    const start = trace.start;
    if (start === undefined) continue;
    const hops = trace.hops.filter((hop) => isTourHop(graph, hop));
    if (hops.length === 0) continue;
    const reached = trace.reached.filter((node) =>
      isTourTraceNode(graph, node),
    );
    const landed = new Set(reached.map((node) => node.id));
    if (told.some((earlier) => overlaps(landed, earlier))) continue;
    told.push(landed);
    const steps = hops
      .slice(0, MAX_FLOW_ANCHORS)
      .map((hop) => flowStepOf(graph, hop));
    // Every node the flow reached is listed, including the ones its steps name.
    // A step is prose — `App.render -[calls at App.tsx:2093]-> renderScene` — and
    // it carries the name and the citation but not the *handle*, and the handle
    // is what a second call needs. Holding back the nodes the steps had named
    // took their ids away with them: Sonnet traced `mutateElement` by name, got
    // the several nodes that name, and re-traced it by id — two calls for one
    // symbol, four times over in a single Excalidraw tour, which went from five
    // graph calls to fifteen. What `reached` is for is not the story, which the
    // steps tell; it is the handles to go on with.
    primaryFlow.push({
      start: flowStartOf(start),
      steps,
      reached: reached.map(traceNodeOf),
      ...(trace.truncated ? { truncated: true } : {}),
    });
  }

  const details =
    seedIds.length === 0
      ? undefined
      : runDetails(graph, {
          type: "details",
          handles: seedIds,
          neighbors: true,
          memberLimit: 4,
          dependencyLimit: 2,
          neighborLimit: 2,
        }).result;
  const nearby = details === undefined ? [] : nearbyAnchorsOf(details);

  const tests =
    props.includeTests === false
      ? []
      : testAnchorsOf(
          graph,
          uniqueIds([
            ...seedIds.slice(0, TEST_SEEDS),
            ...primaryFlow.flatMap((flow) =>
              flow.reached.map((node) => node.id),
            ),
          ]),
        );
  const answerAnchors = uniqueAnchors([
    ...entrypoints.flatMap((node) =>
      anchorFromNode("central entrypoint", node),
    ),
    ...nearby,
    ...tests,
  ]).slice(0, MAX_READ_NEXT);

  return {
    result: {
      type: "tour",
      entrypoints,
      primaryFlow,
      nearby: nearby.slice(0, MAX_NEARBY),
      tests: tests.slice(0, MAX_TESTS),
      answerAnchors,
      ...(entry.truncated ||
      primaryFlow.some((flow) => flow.truncated === true) ||
      nearby.length > MAX_NEARBY ||
      tests.length > MAX_TESTS
        ? { truncated: true }
        : {}),
    },
    next: tourNext(),
  };
}

/**
 * What the tour says it is.
 *
 * It used to say what it had _covered of the question_, and it could not know
 * that. The claim was decided by matching the question's words against
 * identifier names: a word the tour's own symbols did not spell, and for which
 * some symbol somewhere in the graph did, came back as a stage the tour owed
 * the reader — `inspect`, with the tool description telling the model to make
 * exactly the one request it names.
 *
 * What that string match actually found, on the corpus: shopping-backend's
 * question says "from request handling through auth, provider logic, Prisma",
 * and the tour reported "handling" missing on the strength of `handlePayment`
 * and `handleCancel`, two deposit and order helpers with nothing to do with
 * handling a request. Vue's says "a component/template read", and "template"
 * came back missing because the compiler's AST has a `TemplateLiteral`. Zod's
 * ends "the returned result", and `ParseResult.data` made "result" a stage. In
 * five of the eight project-specific tours the server reported a hole it did
 * not have and spent the model a call on it — and the drill-down started there:
 * shopping-backend's eight follow-ups open with the `lookup` this `next` asked
 * for.
 *
 * The failure is not a threshold. A question names concepts and a graph holds
 * identifiers, and no lexical rule bridges the two: "request handling" is not
 * `handlePayment` and never will be. The server cannot know what the question
 * means, so it cannot know whether it answered it — and the audit riding in the
 * same payload says as much, promising a result with nothing "matched, ranked,
 * or inferred" in it.
 *
 * So the tour states what it returned, which is a fact, and leaves what to do
 * with it to the reader, which was never the server's to decide. A tour that
 * misses what the reader needs is a tour the reader keeps asking past — and the
 * models do exactly that, without being told to.
 */
function tourNext(): ITtscGraphNext {
  return resultNext(
    "answer",
    "This is what the graph holds for the query: the entrypoints it ranked, the flows they run, the paths and tests around them, and the anchors to cite. Nothing in it needs verifying, and anything past it is another request.",
  );
}

/**
 * The symbols the caller named, as the graph knows them.
 *
 * A name is not a word. Ranked as text, the reading `setupRenderEffect` — the
 * render effect Opus was asking about, and had written down — is shredded into
 * "setup", "render", "effect", and the tour opens on `queuePostRenderEffect`
 * instead. The model then traced `setupRenderEffect` by hand, which is the call
 * the tour exists to save.
 *
 * So each entry is resolved the way a handle is: the graph either holds that
 * symbol or it does not, and what it does not hold is dropped without ceremony.
 * A phrase is not a name and resolves to nothing, so prose costs the tour
 * nothing — which is what makes a guess free, and a repository the caller has
 * never seen safe to guess about.
 */
function namedNodesOf(
  graph: TtscGraphMemory,
  names: readonly string[],
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name.length === 0 || /\s/.test(name)) continue;
    // An ambiguous guess is not evidence. A name the project declares once is a
    // symbol the caller named; a name it declares many times is a word, and the
    // graph does not get to decide which one was meant. Resolving to the first
    // candidate decides anyway: Sonnet asked for `handlePointerDown`, Excalidraw
    // declares it on several classes, and the tour of a drawing app opened on
    // its line editor and cost eight calls. Boosting all of them instead only
    // spreads the same guess wider. Both are the graph inventing a belief the
    // caller did not have, so an ambiguous name is dropped, exactly like a name
    // the graph has never heard of.
    const resolved = resolveGraphHandle(graph, name);
    if (resolved.node !== undefined) out.add(resolved.node.id);
  }
  return out;
}

function tourSeedsOf(
  graph: TtscGraphMemory,
  entry: ITtscGraphEntrypoints,
  query: string,
  limit: number,
  named: ReadonlySet<string>,
  terms: string[],
): ITtscGraphNode[] {
  const out: ITtscGraphNode[] = [];
  const seen = new Set<string>();
  const add = (node: ITtscGraphNode | undefined): void => {
    if (node === undefined || seen.has(node.id) || !isTourSeed(graph, node))
      return;
    seen.add(node.id);
    out.push(node);
  };
  // A symbol the question names is an entrypoint of the tour, and a name the
  // project declares more than once is not a name the project does not declare.
  // Zod's question says `schema.parse`; the graph holds three `parse`s, so the
  // mention came back as candidates rather than a node, and the tour dropped it
  // and opened on `fromJSONSchema` — the model's first move was to go and trace
  // `ZodType.parse` itself. The candidates arrive ranked by what the package
  // publishes, and a tour is a ranked product: take the reading the ranking put
  // first, which is the one a reader means.
  for (const mention of entry.mentions) {
    const mentioned = mention.node ?? mention.candidates?.[0];
    add(mentioned === undefined ? undefined : graph.node(mentioned.id));
  }
  if (hasExplicitSymbolHandle(query)) {
    for (const hit of entry.hits) add(graph.node(hit.id));
  }
  // The symbols the caller named get seats, and the graph's own centre keeps the
  // rest. A name the *user* wrote is seeded outright, above — it is the symbol
  // the question is about. A name the *caller* wrote is a belief about where the
  // answer lives, which is worth a seat and is not worth the tour: the beliefs
  // are ranked among themselves and take half the seeds, and centrality fills
  // what is left. A caller that names nine symbols does not get nine names and
  // no centre, and one that names the wrong symbol still gets a tour.
  const share = Math.floor(limit * NAMED_SHARE);
  if (share > 0 && named.size !== 0) {
    for (const node of rankedTourSeeds(graph, terms, share, named)) add(node);
  }
  // The other half is the graph's, and the names do not reach it. Weighting the
  // named symbols in this ranking too let them take both halves: Opus named ten
  // symbols along RxJS's subscribe path, they filled the seeds, and `operate` —
  // the second seed of the same tour without any names, and the head of the
  // operator chain the question asked about — fell out of it. The model fetched
  // it by hand and said so. A caller's belief about where the answer lives is
  // worth half a tour; the other half is what the codebase says is central,
  // including the symbol the caller did not think to name.
  for (const node of rankedTourSeeds(graph, terms, limit)) add(node);
  if (out.length === 0) {
    for (const hit of entry.hits) add(graph.node(hit.id));
  }
  return out.slice(0, limit);
}

function graphNodeOf(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphTour.INode {
  const span = node.implementation ?? node.evidence;
  const signature = signatureOf(graph.project, node);
  const doc = docOf(graph.project, node);
  const decorators = decoratorsOf(node);
  return {
    id: node.id,
    name: node.qualifiedName ?? node.name,
    kind: node.kind,
    file: node.file,
    ...(node.evidence?.startLine !== undefined
      ? { line: node.evidence.startLine }
      : {}),
    ...(span !== undefined
      ? {
          sourceSpan: {
            file: span.file,
            startLine: span.startLine,
            ...(span.endLine !== undefined ? { endLine: span.endLine } : {}),
          },
        }
      : {}),
    ...(signature !== undefined ? { signature } : {}),
    ...(doc !== undefined ? { doc } : {}),
    ...(decorators !== undefined ? { decorators } : {}),
  };
}

/**
 * A node a flow reached, as its handle and its line. Its span and signature are
 * already in the flow's `steps` and `anchors`, and carrying them a second time
 * cost half the tour's payload — enough that a client which caps a tool result
 * spilled the whole thing to a file, and the model shelled out to read back its
 * own answer.
 *
 * The file and the kind went the same way, for the same reason: a node id _is_
 * `path/to/file.ts#Owner.member:kind`, so a reached node that also carried them
 * bought one fact three times, and the flows are two thirds of a tour that is
 * re-sent whole on every turn of the conversation it opened. The flow's start
 * keeps the full node; the chain behind it does not need one.
 */
function traceNodeOf(node: ITtscGraphTrace.INode): ITtscGraphTour.IReached {
  return {
    id: node.id,
    name: node.name,
    ...(node.line !== undefined ? { line: node.line } : {}),
  };
}

function flowStartOf(node: ITtscGraphTrace.INode): ITtscGraphTour.INode {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    file: node.file,
    ...(node.line !== undefined ? { line: node.line } : {}),
    ...(node.sourceSpan !== undefined
      ? {
          sourceSpan: {
            file: node.sourceSpan.file,
            startLine: node.sourceSpan.startLine,
            ...(node.sourceSpan.endLine !== undefined
              ? { endLine: node.sourceSpan.endLine }
              : {}),
          },
        }
      : {}),
    ...(node.signature !== undefined ? { signature: node.signature } : {}),
  };
}

function flowAnchorsOf(
  trace: ITtscGraphTrace,
  hops: ITtscGraphTrace.IHop[],
  reached: ITtscGraphTrace.INode[],
): ITtscGraphTour.IAnchor[] {
  return uniqueAnchors([
    ...anchorFromNode("flow start", trace.start),
    ...reached.flatMap((node) => anchorFromNode("flow node", node)),
    ...hops.flatMap((hop) =>
      anchorFromEvidence("flow edge", `${hop.from} -> ${hop.to}`, hop.evidence),
    ),
  ]);
}

/**
 * The words of the question that could name code: the ranking's own terms.
 *
 * A question about TypeORM says "TypeORM", which splits into `type` and `orm`,
 * and both are inside the project's own name — they say nothing about which
 * part of the project is being asked about, while matching a hundred
 * identifiers. Whole-word equality is not enough to drop them, so a term the
 * project name contains goes too.
 */
function queryTermsOf(
  graph: TtscGraphMemory,
  names: readonly string[],
): string[] {
  const project = graph.project.toLowerCase();
  const out: string[] = [];
  for (const name of names) {
    for (const term of subwords(name)) {
      if (term.length <= 2 || project.includes(term)) continue;
      if (!out.includes(term)) out.push(term);
    }
  }
  return out;
}

function rankedTourSeeds(
  graph: TtscGraphMemory,
  terms: string[],
  count: number,
  only?: ReadonlySet<string>,
): ITtscGraphNode[] {
  const items = graph.nodes
    .filter(
      (node) =>
        isTourSeed(graph, node) && (only === undefined || only.has(node.id)),
    )
    .map((node) => ({
      node,
      score: tourSeedScore(graph, node, terms),
      matchedTerms: matchedQueryTerms(node, terms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return diverseTourSeeds(items, terms, count).map((item) => item.node);
}

/**
 * How central a symbol is to running this codebase, as one standard algorithm
 * instead of a ledger of hand-tuned bonuses.
 *
 * This score used to be a sum: so many points for the symbol's kind, so many
 * per log of each degree, a capped term for its reach, another for what its
 * package exports, another for what the tests call — nine signals, each with a
 * multiplier and a cap that someone picked while watching a benchmark. Word
 * lists in numeric form. All of it was approximating one question the graph can
 * answer exactly: _if you use what this package publishes, what runs?_
 *
 * Personalized PageRank answers it. The walker starts on the export surface —
 * the symbols the package puts on the wire, members included — and follows the
 * execution edges, crossing from an abstract declaration to its implementations
 * the way `runTrace` does. Public entries hold mass because the walk starts on
 * them; the spine holds mass because every path runs through it. One damping
 * constant, 0.85, from the literature — the same algorithm aider's repo map
 * ranks symbols with.
 */
function tourSeedScore(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  terms: string[],
): number {
  const queryWords = new Set(terms);
  const matchScore = queryMatchScore(node, terms);
  let score = centralityOf(graph, node.id) + matchScore;
  score *= queryAlignmentFactor(matchScore, queryWords);
  score *= broadTourDamping(node);
  return score;
}

/** Centrality is reported on a 0..100 scale: 100 is this graph's most central. */
const CENTRALITY_SCALE = 100;
/** Execution reach is walked this deep and no further. */
const REACH_DEPTH = 4;
const REACH_NODE_BUDGET = 400;
/** Invocation: the edges that mean "this makes that run". */
const INVOKE_KINDS = new Set<string>(["calls", "instantiates", "renders"]);
const DISPATCH_KINDS = new Set<string>(["overrides", "implements"]);

const centralityCache = new WeakMap<TtscGraphMemory, Map<string, number>>();

function centralityOf(graph: TtscGraphMemory, id: string): number {
  let ranks = centralityCache.get(graph);
  if (ranks === undefined) {
    ranks = computeCentrality(graph);
    centralityCache.set(graph, ranks);
  }
  return ranks.get(id) ?? 0;
}

/**
 * Three facts, one product: `log2(1 + published) * max(reach, fan-in)`.
 *
 * - _Published_: how many modules put the symbol on the wire, counting the class
 *   that owns it — a member is published by publishing its owner.
 * - _Reach_: how many production files its forward invocation chain touches,
 *   crossing from an abstract declaration to the implementations, the way
 *   execution does. This is what separates an entry that drives half the
 *   framework from a fat method whose fifty calls stay in its own file.
 * - _Fan-in_: how many production call sites invoke it. This is what separates
 *   the spine everything runs through from a leaf beside it.
 *
 * The product means a symbol must be public _and_ load-bearing: a utility is
 * published everywhere but drives nothing and dies on the max term's
 * normalization; an internal engine drives everything but is published nowhere
 * and dies on the surface term. Tests and generated support files are not part
 * of the structure being toured and stay out of all three.
 */
function computeCentrality(graph: TtscGraphMemory): Map<string, number> {
  const production = (node: ITtscGraphNode): boolean =>
    !node.external &&
    !node.ignored &&
    !isTestPath(node.file) &&
    !isNoisePath(node.file);

  const invoked = (id: string): string[] => {
    const out: string[] = [];
    let hasBody = false;
    for (const edge of graph.outgoing(id)) {
      if (!INVOKE_KINDS.has(edge.kind)) continue;
      hasBody = true;
      out.push(edge.to);
    }
    if (!hasBody) {
      for (const edge of graph.incoming(id)) {
        if (DISPATCH_KINDS.has(edge.kind)) out.push(edge.from);
      }
    }
    return out;
  };

  const reachOf = (id: string): number => {
    const seen = new Set<string>([id]);
    const files = new Set<string>();
    let frontier = [id];
    for (
      let depth = 0;
      depth < REACH_DEPTH && seen.size < REACH_NODE_BUDGET;
      depth++
    ) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const to of invoked(current)) {
          if (seen.has(to)) continue;
          const target = graph.node(to);
          if (target === undefined || !production(target)) continue;
          seen.add(to);
          files.add(target.file);
          next.push(to);
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }
    return files.size;
  };

  const out = new Map<string, number>();
  const candidates: { id: string; surface: number; fanIn: number }[] = [];
  for (const node of graph.nodes) {
    if (!production(node)) continue;
    const surface = publicFanIn(graph, node.id);
    if (surface <= 0) continue;
    let fanIn = 0;
    for (const edge of graph.incoming(node.id)) {
      if (!INVOKE_KINDS.has(edge.kind)) continue;
      const caller = graph.node(edge.from);
      if (caller !== undefined && production(caller)) fanIn++;
    }
    candidates.push({ id: node.id, surface, fanIn });
  }

  let reachMax = 1;
  let fanInMax = 1;
  const reaches = new Map<string, number>();
  for (const candidate of candidates) {
    const reach = reachOf(candidate.id);
    reaches.set(candidate.id, reach);
    if (reach > reachMax) reachMax = reach;
    if (candidate.fanIn > fanInMax) fanInMax = candidate.fanIn;
  }

  let max = 0;
  const raw = new Map<string, number>();
  for (const candidate of candidates) {
    const load = Math.max(
      (reaches.get(candidate.id) ?? 0) / reachMax,
      candidate.fanIn / fanInMax,
    );
    const score = Math.log2(1 + candidate.surface) * load;
    raw.set(candidate.id, score);
    if (score > max) max = score;
  }
  if (max > 0) {
    for (const [id, score] of raw)
      out.set(id, (score / max) * CENTRALITY_SCALE);
  }
  return out;
}

/**
 * A tour ranks and walks the project's surface.
 *
 * Not because a closure is beneath an index — a trace, a lookup, or a details
 * request answers with one, and that is what the specific-flow lane needed. It
 * is because the seed score leans on reach, and reach breaks when it counts
 * them. Reach stands in for "gets to the code that does the work", and a method
 * whose body is full of callbacks lands in more files than one that calls three
 * things and means them: TypeORM's `SelectQueryBuilder` outranked its insert
 * path on breadth alone, and the tour it led came back a walk through the query
 * builder's fluent API — escape, clone, addSelect, limit, offset — while the
 * insert flow that reaches the broadcaster, the metadata, and the driver fell
 * out of the tour entirely. Wide and shallow beat deep and few, and the model
 * went back to the files.
 *
 * So the surface is scored by the surface, and the body is answered when it is
 * asked for. The specific-flow lane wants the closures and gets them; the
 * orientation lane wants the surface and gets that. Judged by the answer rather
 * than the token count, the gated tour is the better one: it reaches the
 * broadcaster and the driver, where the ungated tour reached `limit` and
 * `offset`.
 */
function isTourSeed(graph: TtscGraphMemory, node: ITtscGraphNode): boolean {
  return (
    node.closure !== true &&
    TOUR_SEED_KINDS.has(node.kind) &&
    (node.kind !== "property" || executionDegree(graph, node.id).out > 0) &&
    !node.external &&
    !node.ignored &&
    node.evidence !== undefined &&
    !isNoisePath(node.file)
  );
}

function flowSeedIdsOf(seeds: ITtscGraphNode[]): string[] {
  const executable = seeds.filter((node) =>
    ["function", "method", "property", "variable"].includes(node.kind),
  );
  const source = executable.length === 0 ? seeds : executable;
  return source.map((node) => node.id);
}

/**
 * True when two flows land in mostly the same places — the same story told
 * twice. Overlap is measured against the smaller flow, so a short chain fully
 * contained in a longer one counts as told, which is what a sibling entry
 * (`parse` beside `safeParse`) actually is.
 */
function overlaps(candidate: Set<string>, told: Set<string>): boolean {
  const smaller = candidate.size <= told.size ? candidate : told;
  const larger = smaller === candidate ? told : candidate;
  if (smaller.size === 0) return true;
  let shared = 0;
  for (const id of smaller) if (larger.has(id)) shared++;
  return shared / smaller.size >= FLOW_OVERLAP;
}

function isTourTraceNode(
  graph: TtscGraphMemory,
  node: ITtscGraphTrace.INode,
): boolean {
  return (
    graph.node(node.id)?.closure !== true &&
    !isNoisePath(node.file) &&
    !isSharedUtility(graph, node.id)
  );
}

function isTourHop(graph: TtscGraphMemory, hop: ITtscGraphTrace.IHop): boolean {
  const from = graph.node(hop.from);
  const to = graph.node(hop.to);
  return (
    from !== undefined &&
    to !== undefined &&
    from.closure !== true &&
    to.closure !== true &&
    !STRUCTURAL_KINDS.has(hop.kind) &&
    !isNoisePath(from.file) &&
    !isNoisePath(to.file) &&
    !isSharedUtility(graph, hop.to)
  );
}

// A fan-in hub that drives no further execution: reached from a dozen-plus
// sites yet calling nothing onward (a shared type, guard, or leaf helper). It is
// a terminus, not a step in the runtime call chain, so the tour drops it from
// the flow to keep the meaningful chain legible — it still surfaces as a seed,
// nearby node, or detail when it is itself the subject.
//
// The `in >= 12` cut is not a fixture-tuned constant: because real-in-degree is
// heavy-tailed, this fixed count lands at the ~93rd percentile of fan-in across
// every benchmark project (900–16k nodes, 92.4–95.5%), so it selects the same
// "top few percent of hubs" band regardless of project size, while the absolute
// floor makes it a no-op on small graphs that have no genuine hub. The `out <= 1`
// guard keeps thin pass-throughs out but never prunes a real branching step.
function isSharedUtility(graph: TtscGraphMemory, id: string): boolean {
  return realDegree(graph, id).in >= 12 && executionDegree(graph, id).out <= 1;
}

function flowStepOf(graph: TtscGraphMemory, hop: ITtscGraphTrace.IHop): string {
  const from = graph.node(hop.from);
  const to = graph.node(hop.to);
  const lhs = from?.qualifiedName ?? from?.name ?? hop.from;
  const rhs = to?.qualifiedName ?? to?.name ?? hop.to;
  const evidence = hop.evidence;
  const at =
    evidence === undefined ? "" : ` at ${evidence.file}:${evidence.startLine}`;
  return `${lhs} -[${hop.kind}${at}]-> ${rhs}`;
}

/**
 * True when the node at the other end of an edge is a closure.
 *
 * A tour scores the surface, and a closure is not on it — but a closure's edges
 * still land on surface nodes, and counted there they move the score of the
 * very declarations a tour ranks. Keeping closures out of the seed list was not
 * enough: TypeORM's tour still traded its insert flow for a walk through the
 * query builder's fluent API. The surface is scored by the surface.
 */
function touchesClosure(graph: TtscGraphMemory, id: string): boolean {
  return graph.node(id)?.closure === true;
}

function realDegree(
  graph: TtscGraphMemory,
  id: string,
): {
  in: number;
  out: number;
} {
  let incoming = 0;
  let outgoing = 0;
  for (const edge of graph.outgoing(id))
    if (!STRUCTURAL_KINDS.has(edge.kind) && !touchesClosure(graph, edge.to))
      outgoing++;
  for (const edge of graph.incoming(id))
    if (!STRUCTURAL_KINDS.has(edge.kind) && !touchesClosure(graph, edge.from))
      incoming++;
  return { in: incoming, out: outgoing };
}

function executionDegree(
  graph: TtscGraphMemory,
  id: string,
): {
  in: number;
  out: number;
} {
  let incoming = 0;
  let outgoing = 0;
  for (const edge of graph.outgoing(id))
    if (EXECUTION_KINDS.has(edge.kind) && !touchesClosure(graph, edge.to))
      outgoing++;
  for (const edge of graph.incoming(id))
    if (EXECUTION_KINDS.has(edge.kind) && !touchesClosure(graph, edge.from))
      incoming++;
  return { in: incoming, out: outgoing };
}

/**
 * What the declaration is, scored by what it does rather than how it was
 * written. `export const parse = (input) => ...` is a function that happens to
 * be bound to a name, and the checker sees it call things; scoring it eight
 * points against a method's twenty-eight is a bias toward one syntax, and it
 * cost zod its own public API — `parse` and `safeParse`, both const arrows,
 * lost their tour seats to `ZodType.safeParse`, a method of the previous
 * major.
 */

/**
 * How many modules put a symbol on the wire — counting the one that owns it.
 *
 * A method is not exported; its class is. `Observable.subscribe` and
 * `ZodType.parse` carry an export fan-in of zero, because nothing re-exports a
 * member: what a package publishes is `Observable`, and calling `subscribe` on
 * it is what publishing `Observable` was for. Scored on its own fan-in, the
 * public method a whole library exists to be called through ranks below every
 * loose function beside it, and a list of English verbs — `parse`, `subscribe`,
 * `render` — was what used to put it back.
 *
 * A member inherits the surface of what contains it. That is an edge the graph
 * already draws, and it says the same thing in a codebase whose classes are
 * named in Japanese.
 */
function publicFanIn(graph: TtscGraphMemory, id: string): number {
  const own = exportFanIn(graph, id);
  const owner = ownerOf(graph, id);
  return owner === undefined ? own : Math.max(own, exportFanIn(graph, owner));
}

function ownerOf(graph: TtscGraphMemory, id: string): string | undefined {
  for (const edge of graph.incoming(id)) {
    if (edge.kind !== "contains") continue;
    const owner = graph.node(edge.from);
    if (
      owner !== undefined &&
      owner.kind !== "file" &&
      owner.kind !== "module"
    ) {
      return owner.id;
    }
  }
  return undefined;
}

/**
 * What a user of this package can call, as the graph knows it.
 *
 * This used to pay for an English verb anywhere in the name — `create`,
 * `parse`, `render`, `subscribe` — and for a class whose name contained `app`,
 * `server` or `factory`. Neither is a fact about the code. They are a guess
 * about the language its authors happened to write in, and a codebase that
 * names its entry `起動` or `mk` or `boot` is one the guess is simply wrong
 * about. It was also wrong in English: `onRenderTracked` is a devtools hook and
 * it took the bonus for the "render" inside it, outranking `track`, the
 * function it is named after.
 *
 * Two facts say the same thing without reading a word of the name. The package
 * _publishes_ this symbol — that is its export surface, counted in
 * {@link exportFanIn} — and it is a _callable_, so publishing it is publishing
 * something to run. A user calls what a package exports and what a package
 * exports to be called.
 */

function queryMatchScore(node: ITtscGraphNode, terms: string[]): number {
  return (
    matchedQueryTerms(node, terms).size * 8 +
    matchedFileTerms(node, terms).size * 2
  );
}

function matchedQueryTerms(node: ITtscGraphNode, terms: string[]): Set<string> {
  const words = [...subwords(node.name), ...subwords(node.qualifiedName ?? "")];
  return matchedTerms(words, terms);
}

function matchedFileTerms(node: ITtscGraphNode, terms: string[]): Set<string> {
  return matchedTerms(subwords(node.file), terms);
}

function matchedTerms(words: string[], terms: string[]): Set<string> {
  const wordSet = new Set(words);
  const stems = new Set(words.map(stemWord));
  const matched = new Set<string>();
  for (const term of terms) {
    if (
      wordSet.has(term) ||
      stems.has(stemWord(term)) ||
      words.some(
        (word) => commonPrefixLength(stemWord(term), stemWord(word)) >= 6,
      )
    ) {
      matched.add(term);
    }
  }
  return matched;
}

/**
 * Greedy set cover over the query's terms: each pick is the highest-scoring
 * candidate that still covers a term no pick covers yet, so the seeds spread
 * across the question instead of crowding onto its loudest word.
 *
 * It picks `count` of them, not all of them. Ordering every candidate cost
 * O(n²) — on VS Code, where tens of thousands of symbols score above zero, one
 * tour spent six minutes ranking seeds it then threw away, because the caller
 * keeps only the first few. Stopping at `count` makes the cover O(count · n),
 * and the picks it does make are the same ones.
 */
function diverseTourSeeds<
  T extends {
    node: ITtscGraphNode;
    score: number;
    matchedTerms: Set<string>;
  },
>(items: T[], terms: string[], count: number): T[] {
  if (items.length <= 1 || terms.length === 0) return items.slice(0, count);
  const out: T[] = [];
  const remaining = [...items];
  const uncovered = new Set(terms);
  while (remaining.length > 0 && out.length < count) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      if (out.some((picked) => restates(picked.node, item.node))) continue;
      let coverage = 0;
      for (const term of item.matchedTerms) if (uncovered.has(term)) coverage++;
      const score = coverage * 120 + item.score;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) break;
    const [picked] = remaining.splice(bestIndex, 1);
    out.push(picked!);
    for (const term of picked!.matchedTerms) uncovered.delete(term);
  }
  return out;
}

/**
 * Whether a candidate seed would only say again what a chosen seed says: the
 * same file, and a name the chosen one already contains word for word.
 *
 * `LinearElementEditor.handlePointerMove` and its `...InEditMode` sibling, and
 * `renderNewElementScene` beside its own throttled twin, took four of the five
 * seeds on Excalidraw's edit-pipeline tour. The mutation and history layers the
 * question named took none, and Sonnet spent twenty-two graph calls finding
 * them. A seed that restates a chosen one is a slot spent on a fact the tour
 * already has.
 */
function restates(chosen: ITtscGraphNode, candidate: ITtscGraphNode): boolean {
  if (chosen.file !== candidate.file) return false;
  const chosenWords = subwords(chosen.name).map(stemWord);
  const candidateWords = subwords(candidate.name).map(stemWord);
  const [shorter, longer] =
    chosenWords.length <= candidateWords.length
      ? [chosenWords, candidateWords]
      : [candidateWords, chosenWords];
  return (
    shorter.length > 0 && shorter.every((word, index) => longer[index] === word)
  );
}

function queryAlignmentFactor(
  matchScore: number,
  queryWords: ReadonlySet<string>,
): number {
  if (queryWords.size === 0) return 1;
  if (matchScore >= 24) return 1.45;
  if (matchScore >= 8) return 1.15;
  return 0.45;
}

/**
 * What a tour demotes, without reading a word of the name.
 *
 * This used to hold four lists of English words -- error, exception, config,
 * env, option, port, serialize, deserialize, internal, private -- and it
 * quartered the score of any symbol whose name contained one, unless the
 * question contained it too. A codebase that names its errors `エラー` was never
 * damped, and a question asked in Japanese never lifted the damping. The lists
 * were a guess about the language, not a fact about the code.
 *
 * A leading underscore stays: it is punctuation, and it means the same thing in
 * every language a symbol can be named in. Everything else a tour used to
 * demote by vocabulary -- a config bag, an error type, a serializer -- the
 * score already demotes by structure: they run nothing, so they carry no
 * execution degree and no execution reach.
 */
function broadTourDamping(node: ITtscGraphNode): number {
  return isPrivateLike(node) ? 0.25 : 1;
}

function isPrivateLike(node: ITtscGraphNode): boolean {
  // The leading underscore is punctuation, not vocabulary: it means the same
  // in a codebase whose symbols are named in Japanese as in one named in
  // English. The words that used to sit here -- "inner", "internal",
  // "private" -- did not.
  const name = node.qualifiedName ?? node.name;
  return name.startsWith("_") || name.includes("._");
}

function hasExplicitSymbolHandle(query: string): boolean {
  return (
    /`[^`]+`/.test(query) ||
    /\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b/.test(query)
  );
}

/** How many leading path segments two files share. */
function sharedPathDepth(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  let shared = 0;
  while (
    shared < left.length - 1 &&
    shared < right.length - 1 &&
    left[shared] === right[shared]
  )
    shared++;
  return shared;
}

function isNoisePath(file: string): boolean {
  return isSupportPath(file);
}

function subwords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

/**
 * A question and the code it asks about name the same thing in different parts
 * of speech: the asker writes "scene mutation", the symbol is `mutateElement`.
 * Inflection alone does not bridge that — "mutation" and "mutate" share five
 * characters and the prefix rule wants six — so a tour of Excalidraw's edit
 * pipeline seeded four renderers, never surfaced the mutation layer the
 * question named, and Sonnet went and found it itself in twenty-one further
 * graph calls.
 *
 * Stripping the derivational suffixes as well collapses both spellings onto the
 * same stem, so the noun in the question reaches the verb in the code.
 */
function stemWord(word: string): string {
  for (const suffix of [
    "ation",
    "ing",
    "ment",
    "ence",
    "ance",
    "ion",
    "ity",
    "ed",
    "es",
    "s",
  ]) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return trimTrailingE(word.slice(0, -suffix.length));
    }
  }
  return trimTrailingE(word);
}

function trimTrailingE(word: string): string {
  return word.length > 4 && word.endsWith("e") ? word.slice(0, -1) : word;
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

/**
 * The code paths around each selected symbol: what runs it, what it runs, and
 * what it is declared against — in that order, once each.
 *
 * `dependsOn` is the union of what a symbol calls and what it names in a type
 * position, so walking `calls`, then `types`, then `dependsOn` listed the same
 * neighbour under three labels, and the ten nearby slots of Excalidraw's edit
 * tour went: `_renderInteractiveScene` as a call, `_renderInteractiveScene` as
 * a type, `InteractiveSceneRenderConfig` as a type, and the same again for the
 * next symbol. Two of five stages consumed the whole list, and the stage the
 * reader would have to look up next — who calls the mutation — was not in it.
 * Sonnet then asked the graph "who calls this" thirteen times.
 *
 * So a neighbour is named once, and the callers come first. A tour follows what
 * runs; a type reference is the weakest thing a symbol can say about itself,
 * and it goes last, where the cap can drop it without dropping a call path.
 */
function nearbyAnchorsOf(details: ITtscGraphDetails): ITtscGraphTour.IAnchor[] {
  const perNode = details.nodes.map((node) => {
    // The selected symbol is not near itself. It is an entrypoint, with its
    // span, its signature and its doc, and it is an answer anchor under that
    // name — a third copy here spent half the nearby list saying what the top
    // of the tour already said.
    const anchors: ITtscGraphTour.IAnchor[] = [];
    const named = new Set<string>([node.name]);
    for (const ref of [
      ...(node.dependedOnBy ?? []),
      ...(node.calls ?? []),
      ...(node.implementedBy ?? []),
      ...(node.dependsOn ?? []),
      ...(node.types ?? []),
    ]) {
      if (named.has(ref.name)) continue;
      named.add(ref.name);
      anchors.push(
        ...anchorFromEvidence(
          `${ref.relation} ${ref.name}`,
          ref.name,
          ref.evidence,
        ),
      );
    }
    return anchors;
  });

  // A stage at a time, not a symbol at a time. The list is capped, and taken
  // symbol by symbol the first one's neighbourhood filled it: Excalidraw's
  // renderer spent six of the ten slots on its own callees and types, and the
  // mutation, the history and the collaboration the question named got none.
  const anchors: ITtscGraphTour.IAnchor[] = [];
  const told = new Set<string>();
  const depth = Math.max(0, ...perNode.map((list) => list.length));
  for (let index = 0; index < depth; index++)
    for (const list of perNode) {
      const anchor = list[index];
      if (anchor === undefined || told.has(anchor.name)) continue;
      told.add(anchor.name);
      anchors.push(anchor);
    }
  return uniqueAnchors(anchors);
}

/**
 * The tests that exercise the tour's symbols, nearest first.
 *
 * A subject is covered by more than one suite: NestJS's
 * `NestFactoryStatic.create` is called by three GraphQL end-to-end specs under
 * integration/ and by the unit spec that sits beside the code, and the tour's
 * slots went to whichever the edge list happened to hold first — the e2e ones.
 * So the model globbed the disk for `packages/core/test/nest-factory.spec.ts`,
 * which the graph had all along. A test that lives next to its subject is the
 * one a newcomer reads, so the anchors come back ordered by how much of the
 * subject's path the test shares.
 */
function testAnchorsOf(
  graph: TtscGraphMemory,
  seedIds: string[],
): ITtscGraphTour.IAnchor[] {
  const anchors: ITtscGraphTour.IAnchor[] = [];
  for (const id of seedIds) {
    const subject = graph.node(id);
    const near: Array<{
      proximity: number;
      anchors: ITtscGraphTour.IAnchor[];
    }> = [];
    for (const edge of graph.incoming(id)) {
      const node = graph.node(edge.from);
      if (node === undefined || !isTestPath(node.file)) continue;
      near.push({
        proximity: sharedPathDepth(subject?.file ?? "", node.file),
        anchors: [
          ...anchorFromNode("test coverage", graphNodeOf(graph, node)),
          ...anchorFromEvidence(
            `${edge.kind} ${node.qualifiedName ?? node.name}`,
            node.qualifiedName ?? node.name,
            edge.evidence,
          ),
        ],
      });
    }
    near.sort((a, b) => b.proximity - a.proximity);
    for (const item of near) anchors.push(...item.anchors);
    const impact = runTrace(graph, {
      type: "trace",
      from: id,
      direction: "impact",
      maxDepth: 4,
      maxNodes: 16,
    }).result;
    for (const node of impact.reached) {
      if (node.roles?.includes("test")) {
        anchors.push(...anchorFromNode("test coverage", node));
      }
    }
  }
  return uniqueAnchors(anchors);
}

function uniqueIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function anchorFromNode(
  reason: string,
  node: ITtscGraphTour.INode | ITtscGraphTrace.INode | undefined,
): ITtscGraphTour.IAnchor[] {
  if (node === undefined) return [];
  const span =
    "sourceSpan" in node && node.sourceSpan !== undefined
      ? node.sourceSpan
      : node.line !== undefined
        ? { file: node.file, startLine: node.line }
        : undefined;
  if (span === undefined) return [];
  return [
    {
      reason,
      id: node.id,
      name: node.name,
      kind: node.kind,
      file: span.file,
      startLine: span.startLine,
      ...(span.endLine !== undefined ? { endLine: span.endLine } : {}),
    },
  ];
}

function anchorFromEvidence(
  reason: string,
  name: string,
  evidence: ITtscGraphEvidence | undefined,
): ITtscGraphTour.IAnchor[] {
  if (evidence === undefined) return [];
  return [
    {
      reason,
      name,
      file: evidence.file,
      startLine: evidence.startLine,
      ...(evidence.endLine !== undefined ? { endLine: evidence.endLine } : {}),
    },
  ];
}

function uniqueAnchors(
  anchors: ITtscGraphTour.IAnchor[],
): ITtscGraphTour.IAnchor[] {
  const out: ITtscGraphTour.IAnchor[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors) {
    const key = `${anchor.file}:${anchor.startLine}:${anchor.name}:${anchor.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(anchor);
  }
  return out;
}

function bound(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = value === undefined || !Number.isFinite(value) ? fallback : value;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

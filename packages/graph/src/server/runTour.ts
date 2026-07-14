import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
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
const QUERY_STOP_WORDS = new Set<string>([
  "about",
  "after",
  "and",
  "are",
  "api",
  "architecture",
  "around",
  "before",
  "based",
  "behavior",
  "between",
  "but",
  "can",
  "central",
  "change",
  "changes",
  "code",
  "does",
  "for",
  "first",
  "find",
  "flow",
  "from",
  "has",
  "have",
  "how",
  "include",
  "including",
  "implementation",
  "into",
  "its",
  "nearby",
  "need",
  "needs",
  "new",
  "next",
  "path",
  "paths",
  // English filler, never a code term. "plus nearby paths and tests" matched
  // ExcalidrawPlus, and that one word — worth a name match and the alignment
  // bonus that rides on it — put an app's export-to-cloud dialog at the head of
  // a tour whose subject was the drawing engine.
  "plus",
  "also",
  "along",
  "well",
  "etc",
  "more",
  "please",
  "project",
  "public",
  "read",
  "real",
  "runtime",
  "should",
  "show",
  "that",
  "the",
  "this",
  "test",
  "tests",
  "trace",
  "through",
  "with",
  "without",
  "tour",
  "typescript",
  "user",
  "what",
  "where",
  "which",
  "work",
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
  const named = namedNodesOf(graph, query, props.reinterpretations);
  const limit = bound(props.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const entry = runEntrypoints(graph, {
    type: "entrypoints",
    query,
    limit,
    neighbors: 1,
  }).result;
  const seeds = tourSeedsOf(graph, entry, query, limit, named);
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
    tourSeedsOf(graph, entry, query, limit * FLOW_SEED_CANDIDATES, named),
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
  question: string,
  names: readonly string[],
): ReadonlySet<string> {
  const out = new Set<string>();
  // A question that names no machinery has nothing to reinterpret, so nothing
  // the caller names is an answer to it. Strip the stop words from "I'm new
  // here, show me the central runtime flow and the tests to read next" and
  // nothing is left: the question is asking for the centre of the repository,
  // and the centre is the graph's to know. Sonnet, asked for names it could not
  // have, guessed RxJS's `lift` and `operate` from memory; the tour narrowed
  // onto them and it spent three more calls climbing back out. The names are how
  // a caller says which of several readings of *its question* it means — with no
  // reading to choose between, they are the model's imagination, and the tour
  // does not rank on imagination.
  if (queryTermsOf(graph, question).length === 0) return out;
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
    for (const node of rankedTourSeeds(graph, query, share, named)) add(node);
  }
  // The other half is the graph's, and the names do not reach it. Weighting the
  // named symbols in this ranking too let them take both halves: Opus named ten
  // symbols along RxJS's subscribe path, they filled the seeds, and `operate` —
  // the second seed of the same tour without any names, and the head of the
  // operator chain the question asked about — fell out of it. The model fetched
  // it by hand and said so. A caller's belief about where the answer lives is
  // worth half a tour; the other half is what the codebase says is central,
  // including the symbol the caller did not think to name.
  for (const node of rankedTourSeeds(graph, query, limit)) add(node);
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
function queryTermsOf(graph: TtscGraphMemory, query: string): string[] {
  const project = graph.project.toLowerCase();
  return subwords(query.replace(/\btypescript\b/gi, "typescript")).filter(
    (term) =>
      term.length > 2 && !QUERY_STOP_WORDS.has(term) && !project.includes(term),
  );
}

function rankedTourSeeds(
  graph: TtscGraphMemory,
  query: string,
  count: number,
  only?: ReadonlySet<string>,
): ITtscGraphNode[] {
  const terms = queryTermsOf(graph, query);
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

function tourSeedScore(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  terms: string[],
): number {
  const degree = realDegree(graph, node.id);
  const execution = executionDegree(graph, node.id);
  const queryWords = new Set(terms);
  const matchScore = queryMatchScore(node, terms);
  let score = kindScore(graph, node);
  const surface = publicSurfaceScore(graph, node);
  score += surface;
  score += runtimeEntryScore(node, surface);
  score += Math.min(14, Math.log2(1 + degree.in) * 4);
  score += Math.min(30, Math.log2(1 + degree.out) * 9);
  // What a symbol drives. The cap used to sit at 28, which Excalidraw's App class
  // (426 execution edges) and an arrow-dragging helper (11) both hit, so the
  // score could not tell the centre of the application from a leaf of it.
  score += Math.min(56, Math.log2(1 + execution.out) * 8);
  score += executionReachScore(graph, node);
  if (node.exported) score += 14;
  if (node.decorators !== undefined && node.decorators.length > 0) score += 10;
  score += matchScore;
  score *= queryAlignmentFactor(matchScore, queryWords);
  score *= broadTourDamping(node, queryWords);
  return score;
}

/**
 * How far the node's own execution carries into the codebase: the files its
 * forward call chain reaches. It leads the seed score, because reaching the
 * work is what the question asks of an entry, and because the export chain
 * cannot say it: a class method is on no module's export table, so NestJS's
 * real entry (`NestFactoryStatic.create`, 37 files reached) carries an export
 * count of zero while a lifecycle hook re-exported through two barrels (7
 * files) carries two.
 *
 * A tour question asks for the flow that runs from the public API to the code
 * that does the work, and "does the work" is a property of the chain, not of
 * the symbol. Fan-out alone cannot see it — a shutdown-hook helper that calls
 * four neighbours outscores a bootstrap entry that calls two functions which
 * between them reach half the framework, which is how NestJS's tour opened on
 * shutdown plumbing while the model went looking for `NestFactory.create`
 * itself. Reach is what separates them, and it is a fact the call graph already
 * holds.
 *
 * Bounded by depth and node budget so a fan-out hub cannot walk the program.
 */
function executionReachScore(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): number {
  return Math.min(64, reachedFiles(graph, node.id) * 1.8);
}

const REACH_DEPTH = 4;
const REACH_NODE_BUDGET = 180;
const reachCache = new WeakMap<TtscGraphMemory, Map<string, number>>();

/** Distinct workspace files the node's forward execution chain touches. */
function reachedFiles(graph: TtscGraphMemory, id: string): number {
  let cache = reachCache.get(graph);
  if (cache === undefined) {
    cache = new Map();
    reachCache.set(graph, cache);
  }
  const hit = cache.get(id);
  if (hit !== undefined) return hit;

  const files = new Set<string>();
  const seen = new Set<string>([id]);
  let frontier = [id];
  for (let depth = 0; depth < REACH_DEPTH && seen.size < REACH_NODE_BUDGET; ) {
    depth++;
    const next: string[] = [];
    for (const current of frontier) {
      for (const edge of graph.outgoing(current)) {
        if (STRUCTURAL_KINDS.has(edge.kind) || edge.kind === "type_ref")
          continue;
        if (seen.has(edge.to) || seen.size >= REACH_NODE_BUDGET) continue;
        const target = graph.node(edge.to);
        if (
          target === undefined ||
          target.external ||
          target.ignored ||
          // A closure is not part of the surface a tour ranks, and counting one
          // moves the score of the declaration that owns it: TypeORM's seeds
          // reordered, its insert flow fell out of the tour, and the model went
          // to the files.
          target.closure === true ||
          isNoisePath(target.file)
        )
          continue;
        seen.add(edge.to);
        files.add(target.file);
        next.push(edge.to);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  cache.set(id, files.size);
  return files.size;
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
function kindScore(graph: TtscGraphMemory, node: ITtscGraphNode): number {
  switch (node.kind) {
    case "function":
    case "method":
      return 28;
    case "property":
    case "variable":
      return executionDegree(graph, node.id).out > 0 ? 26 : 8;
    case "class":
      return 24;
    case "module":
    case "namespace":
      return 16;
    case "enum":
      return 10;
    default:
      return 0;
  }
}

/**
 * How far in front of the codebase a node stands.
 *
 * Where the dump carries an export surface, the number of modules that put a
 * symbol on the wire says it — see {@link exportFanIn} — and a guess drawn from
 * a filename has nothing to add. Where it does not, the filename is all there
 * is, and the old heuristic still speaks.
 */
function publicSurfaceScore(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): number {
  if (!hasExportSurface(graph)) return entrySurfaceScore(node);
  return Math.min(40, Math.log2(1 + exportFanIn(graph, node.id)) * 14);
}

function entrySurfaceScore(node: ITtscGraphNode): number {
  const file = node.file.replace(/\\/g, "/");
  const base = file.slice(file.lastIndexOf("/") + 1).toLowerCase();
  const stem = base.replace(/\.[cm]?[tj]sx?$/, "");
  const depth = sourceDepth(file);
  let score = 0;
  if (stem === "index") {
    if (depth <= 0) score += 48;
    else if (depth === 1) score += 32;
    else if (depth === 2) score += 12;
  } else if (stem === "main" || stem === "server" || stem === "bootstrap")
    score += 42;
  else if (stem === "app" || stem === "application") score += 28;

  if (depth <= 1) score += 22;
  else if (depth === 2) score += 12;
  else if (depth === 3) score += 5;

  if (node.exported && score > 0) score += 12;
  return score;
}

function runtimeEntryScore(node: ITtscGraphNode, surface: number): number {
  const words = new Set([
    ...subwords(node.name),
    ...subwords(node.qualifiedName ?? ""),
  ]);
  if (isPrivateLike(node, words)) return 0;
  const hasVerb = hasAny(words, [
    "bootstrap",
    "create",
    "execute",
    "handle",
    "init",
    "initialize",
    "listen",
    "mount",
    "open",
    "parse",
    "render",
    "run",
    "safe",
    "safeparse",
    "start",
    "startup",
    "subscribe",
    "update",
  ]);
  if (node.kind === "method" && hasVerb) return 90;
  if (
    (node.kind === "function" ||
      node.kind === "property" ||
      node.kind === "variable") &&
    surface > 0 &&
    hasVerb
  ) {
    return 70;
  }
  if (
    node.kind === "class" &&
    hasAny(words, [
      "application",
      "app",
      "backend",
      "client",
      "datasource",
      "factory",
      "server",
    ])
  ) {
    return 45;
  }
  return 0;
}

function sourceDepth(file: string): number {
  const parts = file.split("/").filter(Boolean);
  if (parts[0] === "src") return Math.max(0, parts.length - 2);
  if (parts[0] === "packages" && parts.length >= 3) {
    return Math.max(0, parts.length - 3);
  }
  return Math.max(0, parts.length - 1);
}

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

function broadTourDamping(
  node: ITtscGraphNode,
  queryWords: ReadonlySet<string>,
): number {
  const words = new Set([
    ...subwords(node.name),
    ...subwords(node.qualifiedName ?? ""),
    ...subwords(node.file),
  ]);
  let factor = 1;
  if (
    !hasAny(queryWords, ["internal", "private"]) &&
    isPrivateLike(node, words)
  ) {
    factor *= 0.25;
  }
  if (
    !hasAny(queryWords, ["error", "errors", "exception", "exceptions"]) &&
    hasAny(words, ["error", "errors", "exception", "exceptions"])
  ) {
    factor *= 0.25;
  }
  if (
    !hasAny(queryWords, [
      "config",
      "configuration",
      "env",
      "environment",
      "option",
      "options",
      "port",
    ]) &&
    (node.kind === "variable" || node.kind === "property") &&
    hasAny(words, [
      "config",
      "configuration",
      "env",
      "environment",
      "option",
      "options",
      "port",
    ])
  ) {
    factor *= 0.35;
  }
  if (
    !hasAny(queryWords, [
      "deserialize",
      "deserializer",
      "serializer",
      "serialize",
      "serialization",
    ]) &&
    hasAny(words, [
      "deserialize",
      "deserializer",
      "serializer",
      "serialize",
      "serialization",
    ])
  ) {
    factor *= 0.25;
  }
  return factor;
}

function hasAny(
  words: ReadonlySet<string>,
  candidates: readonly string[],
): boolean {
  return candidates.some((word) => words.has(word));
}

function isPrivateLike(
  node: ITtscGraphNode,
  words: ReadonlySet<string>,
): boolean {
  const name = node.qualifiedName ?? node.name;
  return (
    name.startsWith("_") ||
    name.includes("._") ||
    hasAny(words, ["inner", "internal", "private"])
  );
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

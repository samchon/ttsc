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
import { IRunnerOutput, resultNext } from "./resultNext";
import { decoratorsOf, docOf, runDetails, signatureOf } from "./runDetails";
import { runEntrypoints } from "./runEntrypoints";
import { runTrace } from "./runTrace";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 5;
const FLOW_SEEDS = 4;
/** How many ranked seeds deep to look for flows that actually move. */
const FLOW_SEED_CANDIDATES = 4;
const DETAIL_SEEDS = 3;
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
): IRunnerOutput<ITtscGraphTour> {
  const query = props.query.trim();
  const limit = bound(props.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const entry = runEntrypoints(graph, {
    type: "entrypoints",
    query,
    limit,
    neighbors: 1,
  }).result;
  const seeds = tourSeedsOf(graph, entry, query, limit);
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
    tourSeedsOf(graph, entry, query, limit * FLOW_SEED_CANDIDATES),
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
    // A step already names both of its ends and the file and line the call sits
    // on: `App.render -[calls at App.tsx:2093]-> renderScene`. Listing those
    // nodes again with their coordinates, and then a third time as anchors, is
    // the same fact bought three times — two thirds of a 30 KB tour, re-charged
    // on every turn it stays in context, and a specific-flow question can spend
    // a dozen calls. So `reached` carries what the steps did not name, and the
    // step keeps the citation it already had.
    const named = namesIn(steps);
    primaryFlow.push({
      start: flowStartOf(start),
      steps,
      reached: reached.filter((node) => !named.has(node.name)).map(traceNodeOf),
      ...(trace.truncated ? { truncated: true } : {}),
    });
  }

  const details =
    seedIds.length === 0
      ? undefined
      : runDetails(graph, {
          type: "details",
          handles: seedIds.slice(0, DETAIL_SEEDS),
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
      query,
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
    next: tourNext(graph, query, seeds, primaryFlow),
  };
}

/**
 * What the tour honestly leaves for a second call.
 *
 * The tour used to say `answer` — "the tour covers the question" — on every
 * result, including the ones that plainly did not. Excalidraw's question names
 * the pointer, the mutation, the history, the rendering and the collaboration;
 * the tour has five seed slots, two of them go to renderers, and the history
 * layer is a mid-level sink that no ranking will lift into a seed. It said
 * `answer` anyway, and Sonnet, which does not take that on faith, went and
 * found the missing stages itself: twelve calls, none of them re-asking
 * anything the tour had given, every one of them reaching a stage the tour had
 * not.
 *
 * A server that claims completeness it does not have teaches the model to
 * distrust the claim. So the tour now says what it did not cover, when the
 * thing it did not cover exists: a stage the question named, for which the
 * graph holds a symbol, that no seed and no flow touched. `inspect` names the
 * one request that closes the gap, and `answer` is reserved for the tours that
 * earned it.
 *
 * The bar is deliberately narrow. A question word with no symbol behind it is
 * not a missing stage, it is a word — turning every unmatched noun into an
 * `inspect` would invite a second call from the models that need none (Opus and
 * both Codex tiers answer these questions in one).
 */
function tourNext(
  graph: TtscGraphMemory,
  query: string,
  seeds: ITtscGraphNode[],
  flows: ITtscGraphTour.IFlow[],
): ITtscGraphNext {
  const uncovered = uncoveredStages(graph, query, seeds, flows);
  if (uncovered.length === 0)
    return resultNext(
      "answer",
      "The tour covers the question: its entrypoints, flow, nearby paths, tests, and anchors are the orientation answer.",
    );
  return resultNext(
    "inspect",
    `The tour covers the question except for what it names as ${uncovered.join(" and ")}: the graph holds symbols for that, and no entrypoint or flow above reaches them. Look those up once, then answer from both results.`,
    "lookup",
  );
}

/**
 * How close to the tour's weakest chosen seed a symbol must score before the
 * stage it belongs to counts as one the tour owes the reader.
 */
const STAGE_FLOOR = 0.75;

/**
 * The terms of the question that name something the graph has and the tour did
 * not surface.
 */
function uncoveredStages(
  graph: TtscGraphMemory,
  query: string,
  seeds: ITtscGraphNode[],
  flows: ITtscGraphTour.IFlow[],
): string[] {
  const terms = queryTermsOf(graph, query);
  if (terms.length === 0) return [];

  const told = new Set<string>();
  for (const seed of seeds)
    for (const term of matchedQueryTerms(seed, terms)) told.add(term);
  const flowNames = flows.flatMap((flow) => [
    flow.start.name,
    ...flow.reached.map((node) => node.name),
    ...flow.steps,
  ]);
  for (const term of matchedTerms(
    flowNames.flatMap((name) => subwords(name)),
    terms,
  ))
    told.add(term);

  const missing = terms.filter((term) => !told.has(term));
  if (missing.length === 0 || seeds.length === 0) return [];

  // A stage is missing only when the graph holds a symbol for it that stands
  // comparison with the symbols the tour did choose. Every other word of the
  // question has *some* identifier behind it in a large repository — TypeORM has
  // an "orm" in a hundred names, VS Code has a "communicate" — and calling those
  // missing stages would put an `inspect` on every tour, which costs the models
  // that answer these questions in a single call (Opus, both Codex tiers) a
  // second one for nothing.
  //
  // The bar is the weakest seed the tour did select: a stage the question named,
  // whose best symbol would have belonged among the entrypoints had a slot been
  // free, is a stage the tour owes the reader. Comparing against the tour's own
  // choices keeps the bar scale-free — no threshold to tune per repository.
  const seedFloor = Math.min(
    ...seeds.map((seed) => tourSeedScore(graph, seed, terms)),
  );
  const best = new Map<string, number>();
  for (const node of graph.nodes) {
    if (!isTourSeed(graph, node)) continue;
    const matched = matchedQueryTerms(node, missing);
    if (matched.size === 0) continue;
    const score = tourSeedScore(graph, node, terms);
    for (const term of matched)
      if (score > (best.get(term) ?? 0)) best.set(term, score);
  }
  return missing.filter(
    (term) => (best.get(term) ?? 0) >= seedFloor * STAGE_FLOOR,
  );
}

function tourSeedsOf(
  graph: TtscGraphMemory,
  entry: ITtscGraphEntrypoints,
  query: string,
  limit: number,
): ITtscGraphNode[] {
  const out: ITtscGraphNode[] = [];
  const seen = new Set<string>();
  const add = (node: ITtscGraphNode | undefined): void => {
    if (node === undefined || seen.has(node.id) || !isTourSeed(graph, node))
      return;
    seen.add(node.id);
    out.push(node);
  };
  for (const mention of entry.mentions) {
    add(mention.node === undefined ? undefined : graph.node(mention.node.id));
  }
  if (hasExplicitSymbolHandle(query)) {
    for (const hit of entry.hits) add(graph.node(hit.id));
  }
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
 * A node a flow reached, as a coordinate only. Its span and signature are
 * already in the flow's `steps` and `anchors`, and carrying them a second time
 * cost half the tour's payload — enough that a client which caps a tool result
 * spilled the whole thing to a file, and the model shelled out to read back its
 * own answer. The flow's start keeps the full node; the chain behind it does
 * not need one.
 */
function traceNodeOf(node: ITtscGraphTrace.INode): ITtscGraphTour.INode {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    file: node.file,
    ...(node.line !== undefined ? { line: node.line } : {}),
  };
}

function flowStartOf(node: ITtscGraphTrace.INode): ITtscGraphTour.INode {
  return {
    ...traceNodeOf(node),
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
): ITtscGraphNode[] {
  const terms = queryTermsOf(graph, query);
  const items = graph.nodes
    .filter((node) => isTourSeed(graph, node))
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

/** The symbol names a flow's steps already carry. */
function namesIn(steps: string[]): Set<string> {
  const names = new Set<string>();
  for (const step of steps) {
    const match = /^(.+?) -[.+?]-> (.+)$/.exec(step);
    if (match === null) continue;
    names.add(match[1]!.trim());
    names.add(match[2]!.trim());
  }
  return names;
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

function nearbyAnchorsOf(details: ITtscGraphDetails): ITtscGraphTour.IAnchor[] {
  const anchors: ITtscGraphTour.IAnchor[] = [];
  for (const node of details.nodes) {
    anchors.push(...anchorFromNode("selected symbol", detailNodeOf(node)));
    for (const ref of [
      ...(node.calls ?? []),
      ...(node.types ?? []),
      ...(node.implementedBy ?? []),
      ...(node.dependsOn ?? []),
      ...(node.dependedOnBy ?? []),
    ]) {
      anchors.push(
        ...anchorFromEvidence(
          `${ref.relation} ${ref.name}`,
          ref.name,
          ref.evidence,
        ),
      );
    }
  }
  return uniqueAnchors(anchors);
}

function detailNodeOf(node: ITtscGraphDetails.INode): ITtscGraphTour.INode {
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
    ...(node.decorators !== undefined ? { decorators: node.decorators } : {}),
  };
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

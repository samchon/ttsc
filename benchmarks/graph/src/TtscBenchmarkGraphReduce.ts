// reduce.ts — turn a raw @ttsc/graph dump into the reduced JSON the 3D viewer
// renders. graphdump (Go) emits every node and edge keyed by absolute realpath;
// this script makes it web-ready:
//
//   1. relativize the absolute paths in node ids and files (no machine path ships)
//   2. drop external boundary leaves (node_modules / lib .d.ts) by default
//   3. keep the top-N nodes by degree and prune orphans, so a 50k-symbol project
//      renders as a legible few-thousand-node ontology instead of a hairball
//
// The namespace is pure and has no process, Go, or filesystem dependency.
// `TtscBenchmarkGraphReduceCommand` owns command-line orchestration.

/** Pure graph-dump reduction operations used by the benchmark and its tests. */
export namespace TtscBenchmarkGraphReduce {
  interface RawNode {
    id: string;
    name: string;
    kind: string;
    file: string;
    external?: boolean;
    ignored?: boolean;
  }

  interface RawEdge {
    from: string;
    to: string;
    kind: string;
  }

  interface RawDump {
    schemaVersion?: number;
    project?: string;
    provenance?: string;
    nodes: RawNode[];
    edges: RawEdge[];
  }

  interface ViewerNode {
    id: string;
    name: string;
    kind: string;
    file: string;
    external: boolean;
    ignored: boolean;
    degree: number;
  }

  interface ViewerLink {
    source: string;
    target: string;
    kind: string;
  }

  interface ViewerPayload {
    schemaVersion: 1;
    project: string;
    provenance: string;
    counts: {
      rawNodes: number;
      rawEdges: number;
      nodes: number;
      links: number;
      droppedExternal: number;
      droppedIgnored: number;
      droppedByCap: number;
    };
    nodes: ViewerNode[];
    links: ViewerLink[];
  }

  interface ReduceOptions {
    maxNodes?: number;
    keepExternal?: boolean;
    keepIgnored?: boolean;
  }

  // ---------------------------------------------------------------------------
  // Pure transform
  // ---------------------------------------------------------------------------

  /** Longest shared prefix of POSIX-normalized directories. */
  function commonRoot(directories: readonly string[]): string {
    if (directories.length === 0) return "";
    let parts = posix(directories[0]!).split("/");
    for (const directory of directories.slice(1)) {
      const other = posix(directory).split("/");
      let i = 0;
      while (
        i < parts.length &&
        i < other.length &&
        legacyPathSegmentsEqual(parts, other, i)
      )
        i++;
      parts = parts.slice(0, i);
      if (parts.length === 0) break;
    }
    return parts.join("/");
  }

  function legacyPathSegmentsEqual(
    left: readonly string[],
    right: readonly string[],
    index: number,
  ): boolean {
    const leftVolume = windowsVolumeSegmentCount(left);
    const rightVolume = windowsVolumeSegmentCount(right);
    return leftVolume !== 0 && leftVolume === rightVolume && index < leftVolume
      ? left[index]!.toLowerCase() === right[index]!.toLowerCase()
      : left[index] === right[index];
  }

  function windowsVolumeSegmentCount(parts: readonly string[]): number {
    if (/^[A-Za-z]:$/.test(parts[0] ?? "")) return 1;
    return parts[0] === "" &&
      parts[1] === "" &&
      parts[2] !== undefined &&
      parts[2] !== "" &&
      parts[3] !== undefined &&
      parts[3] !== ""
      ? 4
      : 0;
  }

  function legacyPathIsWithin(candidate: string, root: string): boolean {
    const candidateParts = posix(candidate).split("/");
    const rootParts = posix(root).split("/");
    return (
      rootParts.length <= candidateParts.length &&
      rootParts.every((_, index) =>
        legacyPathSegmentsEqual(rootParts, candidateParts, index),
      )
    );
  }

  function posix(p: string): string {
    return p.replace(/\\/g, "/");
  }

  /** Absolute POSIX, Windows drive, or UNC path; relative dumps skip rerooting. */
  function isAbsolute(p: string): boolean {
    return /^(?:[A-Za-z]:)?\//.test(posix(p));
  }

  function directoryOf(file: string): string {
    const normalized = posix(file).replace(/\/+$/, "");
    const slash = normalized.lastIndexOf("/");
    if (slash < 0) return "";
    return slash === 0 ? "/" : normalized.slice(0, slash);
  }

  /**
   * Make an absolute path project-relative; a path outside the project keeps
   * the portion from its last node_modules/ segment, or its base name, so
   * nothing leaks an absolute machine path. A null root means the dump's paths
   * are already project-relative (the current `ttscgraph dump` contract), so
   * they pass through with their directory structure intact.
   */
  function relativize(abs: string, root: string | null): string {
    const a = posix(abs);
    if (root === null) return a;
    const normalizedRoot = posix(root);
    const r = normalizedRoot === "/" ? "/" : normalizedRoot.replace(/\/+$/, "");
    if (r && (r === "/" || legacyPathIsWithin(a, r)))
      return a.slice(r.length).replace(/^\/+/, "");
    const nm = a.lastIndexOf("node_modules/");
    // A package tail is a deliberate normalization: the same dependency reached
    // through two roots is one thing to look at.
    if (nm >= 0) return a.slice(nm);
    // Anything else keeps its whole path. Collapsing to the basename made the
    // projection non-injective, and node ids are rewritten with it, so two
    // declarations in two files could become one viewer node and an edge could
    // resolve back to the wrong end. A longer label is a cosmetic cost; a
    // collided id is a wrong picture.
    return a;
  }

  /**
   * A node id quotes `#` and `\\` inside its `<path>#<name>:<kind>` components.
   * Rewrite only the decoded path so ids stay stable keys and every edge
   * endpoint (also an id) relativizes identically.
   */
  function rewriteId(id: string, root: string | null): string {
    const hash = graphNodeIdHash(id);
    if (hash < 0) return id;
    return (
      escapeGraphNodeIdPart(
        relativize(unescapeGraphNodeIdPart(id.slice(0, hash)), root),
      ) + id.slice(hash)
    );
  }

  function escapeGraphNodeIdPart(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll("#", "\\#");
  }

  function unescapeGraphNodeIdPart(value: string): string {
    let result = "";
    for (let index = 0; index < value.length; index++) {
      const next = value[index + 1];
      if (value[index] === "\\" && next !== undefined) {
        if (next === "#" || (next === "\\" && !legacyUNCStart(value, index))) {
          result += next;
          index++;
          continue;
        }
      }
      result += value[index];
    }
    return result;
  }

  function legacyUNCStart(value: string, index: number): boolean {
    return (
      index === 0 && value.length > 2 && value[2] !== "\\" && value[2] !== "#"
    );
  }

  function graphNodeIdHash(id: string): number {
    for (let index = 0; index < id.length; index++) {
      if (id[index] !== "#") continue;
      let slashes = 0;
      for (let slash = index - 1; slash >= 0 && id[slash] === "\\"; slash--)
        slashes++;
      if (slashes % 2 === 0) return index;
    }
    return -1;
  }

  /**
   * Collapse every wire kind `ttscgraph dump` emits into the display families
   * the viewer colors and its legend names. An unknown kind passes through and
   * renders with the fallback color.
   *
   * The map has to be total over what a dump can carry. `exports` was missing
   * and therefore drawn in the fallback color under no legend entry and, on the
   * website, under no filter row — visible, unnamed, and unfilterable. The two
   * kinds `TtscGraphEdgeKind` declares beyond this map cannot reach a dump:
   * `contains` is synthesized by the TypeScript memory layer and `dispatches`
   * is trace-only.
   */
  const DISPLAY_KIND: Record<string, string> = {
    calls: "value-call",
    instantiates: "value-call",
    renders: "value-call",
    accesses: "value-call",
    type_ref: "type-ref",
    doc_ref: "doc-ref",
    extends: "heritage",
    implements: "heritage",
    overrides: "heritage",
    exports: "exports",
  };

  function displayKind(kind: string): string {
    return DISPLAY_KIND[kind] ?? kind;
  }

  /**
   * Reduces a raw dump to the viewer payload.
   *
   * Paths are relativized, external nodes are removed, the graph is capped to
   * its highest-degree nodes, and resulting orphans are pruned. The returned `{
   * nodes, links }` shape is ready for react-force-graph.
   */
  export function reduce(
    raw: RawDump,
    {
      maxNodes = 1500,
      keepExternal = false,
      keepIgnored = false,
    }: ReduceOptions = {},
  ): ViewerPayload {
    // Drop external boundary leaves and git-ignored generated code (a Prisma
    // client and the like, tagged `ignored` by the dump) so the authored graph is
    // not buried under codegen.
    const keep = (n: RawNode): boolean =>
      (keepExternal || !n.external) && (keepIgnored || !n.ignored);
    const keptBoundary = raw.nodes.filter(keep);
    // Reroot only absolute paths (the legacy dump contract); a current dump's
    // paths are already project-relative and keep their structure as-is.
    const projectFiles = raw.nodes
      .filter((n) => !n.external && !n.ignored)
      .map((n) => n.file);
    const root =
      projectFiles.length > 0 && isAbsolute(projectFiles[0]!)
        ? // A dump may mix path forms from one valid project: in-project sources
          // are relative, package sources carry a node_modules tail, and other
          // out-of-project sources stay absolute. Mixing those into one common
          // root yields the empty string, so only absolute directories vote.
          commonRoot(projectFiles.filter(isAbsolute).map(directoryOf))
        : null;

    const liveIds = new Set(keptBoundary.map((n) => n.id));
    const liveEdges = raw.edges.filter(
      (e) => liveIds.has(e.from) && liveIds.has(e.to),
    );

    const degree = degreeOf(keptBoundary, liveEdges);
    let kept = keptBoundary;
    let droppedByCap = 0;
    if (kept.length > maxNodes) {
      kept = [...kept]
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
        .slice(0, maxNodes);
      droppedByCap = keptBoundary.length - kept.length;
    }

    const keptIds = new Set(kept.map((n) => n.id));
    const edges = liveEdges.filter(
      (e) => keptIds.has(e.from) && keptIds.has(e.to),
    );
    const finalDegree = degreeOf(kept, edges);

    const nodes: ViewerNode[] = kept
      .filter((n) => (finalDegree.get(n.id) ?? 0) > 0) // prune orphans
      .map((n) => ({
        id: rewriteId(n.id, root),
        name: n.name,
        kind: n.kind,
        file: relativize(n.file, root),
        external: n.external === true,
        ignored: n.ignored === true,
        degree: finalDegree.get(n.id) ?? 0,
      }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: ViewerLink[] = edges
      .map((e) => ({
        source: rewriteId(e.from, root),
        target: rewriteId(e.to, root),
        kind: displayKind(e.kind),
      }))
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    return {
      schemaVersion: 1,
      project: raw.project ?? "",
      provenance: raw.provenance ?? "checker-resolved",
      counts: {
        rawNodes: raw.nodes.length,
        rawEdges: raw.edges.length,
        nodes: nodes.length,
        links: links.length,
        droppedExternal: keepExternal
          ? 0
          : raw.nodes.filter((n) => n.external).length,
        droppedIgnored: keepIgnored
          ? 0
          : raw.nodes.filter((n) => n.ignored && !n.external).length,
        droppedByCap,
      },
      nodes,
      links,
    };
  }

  function degreeOf(
    nodes: readonly { id: string }[],
    edges: readonly { from: string; to: string }[],
  ): Map<string, number> {
    const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    for (const e of edges) {
      if (degree.has(e.from)) degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      if (degree.has(e.to)) degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    }
    return degree;
  }
}

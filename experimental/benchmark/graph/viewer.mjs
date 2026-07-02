// viewer.mjs — turn a raw @ttsc/graph dump into the reduced JSON the 3D viewer
// renders. graphdump (Go) emits every node and edge keyed by absolute realpath;
// this script makes it web-ready:
//
//   1. relativize the absolute paths in node ids and files (no machine path ships)
//   2. drop external boundary leaves (node_modules / lib .d.ts) by default
//   3. keep the top-N nodes by degree and prune orphans, so a 50k-symbol project
//      renders as a legible few-thousand-node ontology instead of a hairball
//
// The reduce() function is pure and has no Go or filesystem dependency, so it is
// unit-checkable with `node viewer.mjs --demo`. Producing the real vscode graph
// needs Go and the prepared fixture (see --project), which run on a build host.
//
// Usage:
//   node experimental/benchmark/graph/viewer.mjs --demo
//   node experimental/benchmark/graph/viewer.mjs --in raw.json --name vscode
//   node experimental/benchmark/graph/viewer.mjs --project vscode \
//     --root experimental/benchmark/.work/ttsc-benchmark-vscode@ttsc --tsconfig src/tsconfig.json
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const PUBLIC_GRAPH_DIR = path.join(REPO_ROOT, "website", "public", "graph");

// ---------------------------------------------------------------------------
// Pure transform
// ---------------------------------------------------------------------------

/** Longest shared directory prefix of POSIX-normalized paths. */
function commonRoot(files) {
  if (files.length === 0) return "";
  let parts = posix(files[0]).split("/");
  for (const file of files.slice(1)) {
    const other = posix(file).split("/");
    let i = 0;
    while (i < parts.length && i < other.length && parts[i] === other[i]) i++;
    parts = parts.slice(0, i);
    if (parts.length === 0) break;
  }
  return parts.join("/");
}

function posix(p) {
  return p.replace(/\\/g, "/");
}

/**
 * Make an absolute path project-relative; a path outside the project keeps the
 * portion from its last node_modules/ segment, or its base name, so nothing
 * leaks an absolute machine path.
 */
function relativize(abs, root) {
  const a = posix(abs);
  const r = posix(root).replace(/\/+$/, "");
  if (r && (a === r || a.startsWith(r + "/")))
    return a.slice(r.length).replace(/^\/+/, "");
  const nm = a.lastIndexOf("node_modules/");
  if (nm >= 0) return a.slice(nm);
  const slash = a.lastIndexOf("/");
  return slash >= 0 ? a.slice(slash + 1) : a;
}

/**
 * A node id is `<path>#<name>:<kind>`; rewrite only the path prefix so ids stay
 * a stable key and every edge endpoint (also an id) relativizes identically.
 */
function rewriteId(id, root) {
  const hash = id.indexOf("#");
  if (hash < 0) return id;
  return relativize(id.slice(0, hash), root) + id.slice(hash);
}

/**
 * Collapse the fine-grained wire kinds `ttscgraph dump` emits (calls,
 * instantiates, renders, accesses, type_ref, extends, implements) into the
 * three display families the viewer colors and its legend name. An unknown kind
 * passes through and renders with the fallback color.
 */
const DISPLAY_KIND = {
  calls: "value-call",
  instantiates: "value-call",
  renders: "value-call",
  accesses: "value-call",
  type_ref: "type-ref",
  extends: "heritage",
  implements: "heritage",
};

function displayKind(kind) {
  return DISPLAY_KIND[kind] ?? kind;
}

/**
 * Reduce a raw dump to the viewer payload: relativized, external-free, capped
 * to the highest-degree nodes, with orphans pruned. Returns `{ nodes, links }`
 * shaped for react-force-graph (node.id, link.source/target).
 */
export function reduce(
  raw,
  { maxNodes = 1500, keepExternal = false, keepIgnored = false } = {},
) {
  // Drop external boundary leaves and git-ignored generated code (a Prisma
  // client and the like, tagged `ignored` by the dump) so the authored graph is
  // not buried under codegen.
  const keep = (n) =>
    (keepExternal || !n.external) && (keepIgnored || !n.ignored);
  const keptBoundary = raw.nodes.filter(keep);
  const root = commonRoot(
    raw.nodes.filter((n) => !n.external && !n.ignored).map((n) => n.file),
  );

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

  const nodes = kept
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
  const links = edges
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

function degreeOf(nodes, edges) {
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (degree.has(e.from)) degree.set(e.from, degree.get(e.from) + 1);
    if (degree.has(e.to)) degree.set(e.to, degree.get(e.to) + 1);
  }
  return degree;
}

// ---------------------------------------------------------------------------
// A tiny synthetic dump so the pipeline (and the viewer) has data with no Go.
// ---------------------------------------------------------------------------

const DEMO_RAW = (() => {
  const dir = "/build/app/src";
  const id = (file, name, kind) => `${dir}/${file}#${name}:${kind}`;
  const node = (file, name, kind, external = false) => ({
    id: id(file, name, kind),
    name,
    kind,
    file: `${dir}/${file}`,
    external,
    pos: 0,
    end: 0,
  });
  return {
    schemaVersion: 1,
    project: "demo",
    provenance: "checker-resolved",
    nodes: [
      node("editor.ts", "Editor", "class"),
      node("editor.ts", "Editor.render", "method"),
      node("render/shape.ts", "ShapeRenderer", "class"),
      node("render/shape.ts", "ShapeRenderer.draw", "method"),
      node("render/shape.ts", "rasterize", "function"),
      node("render/canvas.ts", "Canvas", "class"),
      node("model/shape.ts", "Shape", "interface"),
      node("model/shape.ts", "ShapeKind", "type"),
      node("widget.ts", "Widget", "class"),
      node("node_modules/three/three.d.ts", "Object3D", "class", true),
    ],
    edges: [
      {
        from: id("editor.ts", "Editor.render", "method"),
        to: id("render/shape.ts", "ShapeRenderer", "class"),
        kind: "value-call",
      },
      {
        from: id("render/shape.ts", "ShapeRenderer.draw", "method"),
        to: id("render/shape.ts", "rasterize", "function"),
        kind: "value-call",
      },
      {
        from: id("render/shape.ts", "ShapeRenderer.draw", "method"),
        to: id("render/canvas.ts", "Canvas", "class"),
        kind: "value-call",
      },
      {
        from: id("render/shape.ts", "ShapeRenderer", "class"),
        to: id("render/canvas.ts", "Canvas", "class"),
        kind: "type-ref",
      },
      {
        from: id("render/canvas.ts", "Canvas", "class"),
        to: id("node_modules/three/three.d.ts", "Object3D", "class"),
        kind: "heritage",
      },
      {
        from: id("render/shape.ts", "ShapeRenderer.draw", "method"),
        to: id("model/shape.ts", "Shape", "interface"),
        kind: "type-ref",
      },
      {
        from: id("model/shape.ts", "Shape", "interface"),
        to: id("model/shape.ts", "ShapeKind", "type"),
        kind: "type-ref",
      },
      {
        from: id("editor.ts", "Editor", "class"),
        to: id("editor.ts", "Editor.render", "method"),
        kind: "value-call",
      },
      {
        from: id("editor.ts", "Editor", "class"),
        to: id("widget.ts", "Widget", "class"),
        kind: "heritage",
      },
    ],
  };
})();

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { maxNodes: 1500, keepExternal: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--demo") opts.demo = true;
    else if (a === "--keep-external") opts.keepExternal = true;
    else if (a === "--in") opts.in = argv[++i];
    else if (a === "--name") opts.name = argv[++i];
    else if (a === "--project") opts.project = argv[++i];
    else if (a === "--root") opts.root = argv[++i];
    else if (a === "--tsconfig") opts.tsconfig = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--max-nodes") opts.maxNodes = Number(argv[++i]);
  }
  return opts;
}

/**
 * Run the Go graphdump for a prepared fixture and return the parsed raw dump.
 * The go.mod is rooted at packages/ttsc, so go runs there with the package path
 * relative to it and an absolute --cwd for the fixture.
 */
function dumpFromGo(root, tsconfig) {
  const stdout = execFileSync(
    "go",
    [
      "run",
      "./cmd/graphdump",
      "--cwd",
      path.resolve(REPO_ROOT, root),
      "--tsconfig",
      tsconfig,
    ],
    {
      cwd: path.join(REPO_ROOT, "packages", "ttsc"),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 512,
    },
  );
  return JSON.parse(stdout);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let raw;
  let name;
  if (opts.demo) {
    raw = DEMO_RAW;
    name = opts.name ?? "sample";
  } else if (opts.in) {
    raw = JSON.parse(fs.readFileSync(opts.in, "utf8"));
    name = opts.name ?? raw.project ?? "graph";
  } else if (opts.project) {
    if (!opts.root || !opts.tsconfig) {
      console.error("--project needs --root <fixtureDir> --tsconfig <path>");
      process.exit(1);
    }
    raw = dumpFromGo(opts.root, opts.tsconfig);
    name = opts.name ?? opts.project;
  } else {
    console.error(
      "nothing to do: pass --demo, --in <raw.json>, or --project <name> --root <dir> --tsconfig <path>",
    );
    process.exit(1);
  }

  const reduced = reduce(raw, {
    maxNodes: opts.maxNodes,
    keepExternal: opts.keepExternal,
  });
  reduced.project = name;

  const out = opts.out ?? path.join(PUBLIC_GRAPH_DIR, `${name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(reduced));

  const c = reduced.counts;
  console.error(
    `${name}: ${c.nodes} nodes / ${c.links} links ` +
      `(raw ${c.rawNodes}/${c.rawEdges}, dropped ${c.droppedExternal} external + ${c.droppedIgnored} ignored + ${c.droppedByCap} by cap) -> ${path.relative(REPO_ROOT, out)}`,
  );
}

// Run only when invoked as a script, so `reduce` can be imported (by the
// stress test, and later by the browser playground) without side effects.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

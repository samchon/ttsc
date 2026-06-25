import { IGraphEdge, IGraphNode, IRouteMetadata } from "../../schema";

/**
 * Synthesize Next.js page routes from file paths. A `page` file under `app/` or
 * a module under `pages/` becomes a `route` virtual node whose path is derived
 * from the directory structure — dynamic `[id]` segments become `:id`,
 * catch-all `[...rest]` becomes `*`, and route groups `(group)` drop out —
 * linked by a `route --handles_route--> component` edge to the file's exported
 * page component so a trace from the route reaches the component and what it
 * renders.
 *
 * This is file-convention inference, tagged framework-derived. Non-page files
 * (`layout`, `_app`, `api/*`) yield no route.
 */
export function synthesizeNextRoutes(nodes: readonly IGraphNode[]): {
  nodes: IGraphNode[];
  edges: IGraphEdge[];
} {
  // The first exported symbol declared in each file is taken as its page
  // component — the default export a page module is required to have.
  const pageExport = new Map<string, IGraphNode>();
  for (const node of nodes) {
    if (node.external || node.kind === "file") continue;
    if (!node.exported) continue;
    if (!pageExport.has(node.file)) pageExport.set(node.file, node);
  }

  const routeNodes: IGraphNode[] = [];
  const edges: IGraphEdge[] = [];
  const seen = new Set<string>();

  for (const file of pageExport.keys()) {
    const path = nextRoutePath(file);
    if (path === undefined) continue;
    const id = `route:page:${path}`;
    const handler = pageExport.get(file);
    if (!seen.has(id)) {
      seen.add(id);
      const route: IRouteMetadata = {
        protocol: "page",
        framework: "next",
        path,
        handler: handler?.id,
      };
      routeNodes.push({
        id,
        kind: "route",
        name: `page ${path}`,
        file,
        external: false,
        route,
      });
    }
    if (handler !== undefined) {
      edges.push({
        from: id,
        to: handler.id,
        kind: "handles_route",
        provenance: "framework-derived",
        confidence: "medium",
      });
    }
  }

  return { nodes: routeNodes, edges };
}

/**
 * The route path a Next.js file maps to, or undefined when the file is not a
 * routable page. Handles both the `app/` (a `page` file) and `pages/` routers.
 */
export function nextRoutePath(file: string): string | undefined {
  const ext = /\.(tsx|ts|jsx|js)$/;
  if (!ext.test(file)) return undefined;

  const app = lastIndexOfSegment(file, "app");
  if (app >= 0) {
    const rest = file.slice(app + "app/".length);
    const base = rest.replace(ext, "");
    if (!/(^|\/)page$/.test(base)) return undefined; // only `page` files route
    const segments = base.split("/").slice(0, -1); // drop the `page` leaf
    return toRoutePath(segments);
  }

  const pages = lastIndexOfSegment(file, "pages");
  if (pages >= 0) {
    const rest = file.slice(pages + "pages/".length);
    const base = rest.replace(ext, "");
    const segments = base.split("/");
    const head = segments[0];
    if (
      head === "api" ||
      head === "_app" ||
      head === "_document" ||
      head === "_error"
    ) {
      return undefined;
    }
    // `index` is the directory root.
    const trimmed =
      segments[segments.length - 1] === "index"
        ? segments.slice(0, -1)
        : segments;
    return toRoutePath(trimmed);
  }

  return undefined;
}

/** The byte offset just past a `<name>/` path segment, or -1 if absent. */
function lastIndexOfSegment(file: string, name: string): number {
  const slashed = file.lastIndexOf(`/${name}/`);
  if (slashed >= 0) return slashed + 1;
  return file.startsWith(`${name}/`) ? 0 : -1;
}

/** Convert Next path segments to a route path, resolving dynamic conventions. */
function toRoutePath(segments: string[]): string {
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment === "" || isRouteGroup(segment)) continue; // (group) and (.) drop
    const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
    if (catchAll) {
      parts.push("*");
      continue;
    }
    const dynamic = /^\[(.+)\]$/.exec(segment);
    parts.push(dynamic ? `:${dynamic[1]}` : segment);
  }
  return "/" + parts.join("/");
}

/** A Next route group `(group)` — organizational, not part of the path. */
function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

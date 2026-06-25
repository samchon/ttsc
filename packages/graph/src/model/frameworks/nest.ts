import {
  IDecoratorFact,
  IGraphEdge,
  IGraphNode,
  IRouteMetadata,
} from "../../schema";

// The HTTP verbs NestJS exposes as method decorators. The decorator name is
// matched on its last segment, so both `@Get` and the ttsc-ecosystem
// `@TypedRoute.Get` resolve to the same verb.
const HTTP_METHODS = new Set([
  "Get",
  "Post",
  "Put",
  "Patch",
  "Delete",
  "All",
  "Options",
  "Head",
]);

/**
 * Synthesize NestJS HTTP routes from decorator facts. A method decorated with a
 * verb inside a class decorated `@Controller(prefix)` becomes a `route` virtual
 * node whose resolved path composes the controller prefix with the method path,
 * plus a `route --handles_route--> handler` edge so a forward trace from the
 * route reaches the controller method and the services it calls.
 *
 * This is framework convention, not checker resolution, so every node and edge
 * is tagged `framework-derived`. A verb decorator on a method whose class is
 * not a `@Controller` is ignored — that discipline keeps the pass from
 * inventing routes for look-alike decorators.
 */
export function synthesizeNestRoutes(
  nodes: readonly IGraphNode[],
  ownerOf: (node: IGraphNode) => IGraphNode | undefined,
): { nodes: IGraphNode[]; edges: IGraphEdge[] } {
  const routeNodes: IGraphNode[] = [];
  const edges: IGraphEdge[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.kind !== "method" || node.external) continue;
    const verb = routeVerb(node.decorators);
    if (verb === undefined) continue;

    const owner = ownerOf(node);
    const prefix = controllerPrefix(owner?.decorators);
    if (prefix === undefined) continue; // not inside a @Controller — not a route

    const path = joinPath(prefix, verb.path);
    const id = `route:http:${verb.method}:${path}`;
    if (!seen.has(id)) {
      seen.add(id);
      const route: IRouteMetadata = {
        protocol: "http",
        framework: "nest",
        method: verb.method,
        path,
        handler: node.id,
      };
      routeNodes.push({
        id,
        kind: "route",
        name: `${verb.method} ${path}`,
        file: node.file,
        external: false,
        route,
        evidence: node.evidence,
      });
    }
    edges.push({
      from: id,
      to: node.id,
      kind: "handles_route",
      provenance: "framework-derived",
      confidence: "medium",
    });
  }

  return { nodes: routeNodes, edges };
}

/** The HTTP verb and path of a method's route decorator, or undefined. */
function routeVerb(
  decorators: IDecoratorFact[] | undefined,
): { method: string; path: string } | undefined {
  if (decorators === undefined) return undefined;
  for (const decorator of decorators) {
    const last = lastSegment(decorator.name);
    if (HTTP_METHODS.has(last)) {
      return {
        method: last.toUpperCase(),
        path: firstStringLiteral(decorator.arguments) ?? "",
      };
    }
  }
  return undefined;
}

/** The `@Controller(prefix)` prefix, "" for a bare `@Controller`, or undefined. */
function controllerPrefix(
  decorators: IDecoratorFact[] | undefined,
): string | undefined {
  if (decorators === undefined) return undefined;
  for (const decorator of decorators) {
    if (lastSegment(decorator.name) === "Controller") {
      return firstStringLiteral(decorator.arguments) ?? "";
    }
  }
  return undefined;
}

/** The decorator name's last segment (`TypedRoute.Get` -> `Get`). */
function lastSegment(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1) : name;
}

/** The first string-literal argument value, or undefined. */
function firstStringLiteral(
  args: IDecoratorFact["arguments"],
): string | undefined {
  for (const arg of args) {
    if (typeof arg.literal === "string") return arg.literal;
  }
  return undefined;
}

/** Compose path segments into one rooted path (`users` + `:id` -> `/users/:id`). */
function joinPath(prefix: string, path: string): string {
  const segments = [prefix, path]
    .flatMap((part) => part.split("/"))
    .filter((segment) => segment.length > 0);
  return "/" + segments.join("/");
}

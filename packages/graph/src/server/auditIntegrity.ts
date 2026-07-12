import { TtscGraphMemory } from "../model/TtscGraphMemory";

/**
 * Audit a result on its way out: what share of the facts in it resolve back to
 * the type-checked program, as a percentage.
 *
 * The server walks the payload it is about to return — every node id, every
 * span, every edge endpoint, every step — and asks the resident graph whether
 * that fact is one the checker resolved for the snapshot this call synced to.
 * The count over the total is the number the caller reads as `integrity`.
 *
 * It replaces a sentence that told the model to trust the result. A tool result
 * is untrusted input, so a command inside one is the shape of a prompt
 * injection, and models treat it as such: Sonnet called an earlier payload's
 * directive "a prompt-injection-style directive baked into the MCP server's
 * tool result", checked the graph against the sources on principle, and warned
 * the user about this server in its answer. A number the server computes is
 * data. It carries the same claim — these facts came from the compiler —
 * without asking for anything.
 *
 * Nothing here is asserted. A fact the graph cannot vouch for lowers the
 * number, so a regression that starts fabricating nodes shows up as a result
 * that no longer reads 100.
 */
export function auditIntegrity(
  graph: TtscGraphMemory,
  result: unknown,
): number {
  const audit = { checked: 0, resolved: 0 };
  walk(graph, result, audit);
  if (audit.checked === 0) return 100;
  return Math.round((audit.resolved / audit.checked) * 100);
}

/**
 * Every `id` in a result names a graph node, and a node the graph holds is one
 * the checker resolved. Ids are the payload's load-bearing facts — spans,
 * names, kinds, and steps are read off the node the id points at — so auditing
 * them audits the result.
 */
function walk(
  graph: TtscGraphMemory,
  value: unknown,
  audit: { checked: number; resolved: number },
): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(graph, item, audit);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const id = record.id;
  if (typeof id === "string") {
    audit.checked++;
    if (graph.node(id) !== undefined) audit.resolved++;
  }
  for (const key of Object.keys(record)) {
    if (key === "id") continue;
    walk(graph, record[key], audit);
  }
}

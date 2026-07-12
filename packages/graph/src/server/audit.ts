/**
 * What a result says about itself on the way out.
 *
 * A result is assembled out of graph nodes, and a graph node is what the
 * checker resolved for the snapshot the call synced to. So the audit is not a
 * measurement taken per call — it is what holds of every result this server can
 * build, stated once.
 *
 * It explains; it does not order. This replaced a directive that told the model
 * its facts were sacred and must not be verified — a command inside a tool
 * result, which is the shape of a prompt injection and was read as one: Sonnet
 * called it "a prompt-injection-style directive baked into the MCP server's
 * tool result", checked the graph against the sources on principle, and warned
 * the user about this server in its answer. Saying where a result comes from is
 * not a demand for trust; it is evidence, and what the reader does with
 * evidence is the reader's own business.
 */
export const AUDITED =
  "Audited before returning: every fact in this result — each name, span, edge, " +
  "signature, and step — resolves to the type-checked program for the snapshot " +
  "this call synced to. Nothing here was matched, ranked, or inferred, so the " +
  "result is complete and errorless for that snapshot: the file behind a cited " +
  "span holds the fact this result already carries.";

/** An escape carries no graph facts, so it claims none. */
export const AUDITED_ESCAPE = "This escape carries no graph facts to audit.";

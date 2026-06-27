/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short; the per-tool descriptions carry the detail.
 */
export const instructions = `
This TypeScript project is indexed by the compiler. Use these tools before
shell-reading TypeScript source: they already know resolved symbols, edges,
evidence spans, decorators, and stable handles.

- question_entrypoints: first call for a natural-language code question. Use it
  once to get ranked starting symbols, direct mentions, and a small dependency
  orientation slice without source bodies.
- dependency_path: dependency and call/type flow. Use it for "how A reaches B",
  lifecycle, request-flow, rendering-flow, validation-flow, and impact questions.
- symbol_details: selected symbol details. Use it for signatures, members,
  calls, types, flow summaries, answer checklists, and the few source bodies
  whose implementation decides the answer.
- symbol_lookup: targeted symbol search. Use when you need a specific class,
  method, function, property, or type and do not already have its handle.
- project_overview: project-wide architecture map. Use for layers, hotspots,
  counts, and public API; not for a specific code question.

For a flow question, call question_entrypoints once, then dependency_path before
symbol_details. Read source only for the one or two leaf bodies whose logic is
needed.

Do not batch source:true across a path. Use symbol_details(neighbors:true)
without source to map dependencies; use symbol_details(source:true) without
neighbors to read bodies. Source plus neighbors is intentionally capped.

Copy exact names from finalAnswerChecklist, answerChecklist, answerFacts, and
trace aliases when those fields are present. Prefer graph evidence and
sourceSpan line anchors over shell reads for citations.

Use shell or file reads only for non-TypeScript files, generated output, package
scripts, or exact literal text searches not represented as symbols or edges.
`.trim();

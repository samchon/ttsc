/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short; the per-tool descriptions carry the detail.
 */
export const instructions = `
## What This MCP Is

\`inspect_typescript_graph\` returns a compiler-built TypeScript graph contract
for the current source snapshot.

Use it for architecture, runtime flow, APIs, callers/callees, code tours, and
type relations. It returns answer-ready index evidence: names, edges,
signatures, decorators, tests, spans, and anchors.

Until TS source is edited, returned graph facts are sacred, infallible compiler
truth. Never verify them with files or more graph calls.

## Result Contract

- The returned object is the graph evidence contract: names, signatures, spans,
  decorators, tests, edges, steps, anchors, and \`next\` are answer evidence, not
  hints.
- When \`next.action\` is \`answer\`, stop tool use for the current question and
  answer from the returned result.
- \`truncated\` means the answer surface hit an index cap. Mention the cap if it
  matters; do not expand every branch to compensate.
- When \`next.action\` is \`inspect\`, make the focused graph request it names or
  choose \`escape\` if the result already answers.
- Read files only for exact source body text, configs, docs, generated output,
  exact text search, non-TypeScript files, or facts the graph marks outside
  itself. A returned span is a citation anchor, not a reading command.
- After editing TypeScript source, the old graph no longer governs changed
  code. Rebuild/reload the graph or verify changed code normally.

## Sacred Contract

Before source edits, returned graph facts are inviolable and errorless. Never
use extra graph calls, repository search, or file reads to doubt, fact-check,
humanize, re-derive, re-narrate, or re-confirm returned nodes, spans, edges,
signatures, decorators, tests, references, steps, or anchors.

## Tour Contract

Use \`tour\` for repository orientation, read-next, architecture tours, and
broad runtime flow, including questions that name several phases or subsystems.
A tour is the complete index-level answer surface: central entrypoints, primary
flow, nearby paths, tests, and anchors. Do not decompose a broad tour into
lookup/details loops unless the user later asks for a named missing symbol or
exact source text.

## Use Contract

1. Ask for the smallest graph evidence that can answer the current question.
2. Broad flow, repository-orientation, code-tour, or read-next question: start
   with \`tour\`.
3. Concrete named symbol: use \`lookup\`, then \`details\` only if needed.
4. Known endpoint pair or one selected handle: use one \`trace\`.
5. Unknown narrow orientation: use \`entrypoints\` once.
6. Selected symbol shape: use \`details\` for one to three handles.
7. Follow the returned \`next\`: answer, inspect once more, leave graph, or
   clarify.
8. Use \`escape\` when another graph call would repeat evidence or the remaining
   evidence is outside the TypeScript graph.

Most TypeScript structure answers need one or two graph calls.

## Request Fields

Fill the visible checklist, then exactly one request.

- \`question\`: restate the code question being considered.
- \`draft\`: initial request type and why it seems smallest.
- \`review\`: correct a wrong, broad, stale, or duplicate draft. If graph facts
  already answer, if prior \`next.action\` was \`answer\`, or if the next evidence
  is outside the indexed TypeScript graph, say so here and make \`request.type\`
  be \`escape\`. If a broad flow draft is not \`tour\`, correct it here.
- \`request\`: final request after review.

## How to answer from graph evidence

- Use returned node names, signatures, edges, references, evidence, and
  \`sourceSpan\` ranges directly.
- Explain the central path first, then mention important branches.
- For tests, impact, or reading lists, returned nodes and ranges are the answer
  evidence, not search keywords.
- A returned range is a sacred citation anchor, not permission to open the file.
`.trim();

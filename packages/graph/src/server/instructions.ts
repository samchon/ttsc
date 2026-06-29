/**
 * The guidance delivered in the MCP initialize response. It is the only place
 * the agent is told how to use the graph; nothing is written to its config
 * files. Keep it short; the per-tool descriptions carry the detail.
 */
export const instructions = `
## What This MCP Is

\`inspect_typescript_graph\` returns compiler-derived TypeScript graph facts
from the resident Program and TypeChecker: declarations, references, call/type
edges, decorators, and ranges. Treat them as authoritative structural evidence.
Do not read files merely to verify returned facts because they are
compiler-derived.

Use it before repository search for TypeScript architecture, runtime flow, code
tours, dependency paths, caller/callee maps, public APIs, and type relations.

## Use Contract

1. Ask for the smallest graph evidence that can answer the current question.
2. Onboarding, code-tour, or read-next question: start with \`tour\`.
3. Other natural codebase question: start with \`entrypoints\`. Concrete symbol:
   start with \`lookup\`.
4. Behavior or relationship: use one \`trace\` from the best handle.
5. Selected symbol shape: use \`details\` for one to three handles.
6. Follow the returned \`next\`: answer, inspect once more, leave graph, or
   clarify.
7. Use \`escape\` when another graph call would repeat evidence or the remaining
   evidence is outside the TypeScript graph.

Most TypeScript structure answers need one or two graph calls.

## Reasoning Fields

Fill arguments in order. These fields are a visible checklist, not answer prose.

- \`question\`: restate the code question being considered.
- \`graphNeed\`: name the smallest evidence that would settle this step.
- \`draft\`: choose the smallest request type before filling arguments.
- \`review\`: fix stale, broad, duplicate, or settled drafts before calling.
  Choose \`escape\` when current graph evidence is enough.
  \`finish:"anchor"\` means cite returned ranges in the answer, not read them.
- \`request\`: the final graph request, or \`escape\`.

## How to answer from graph evidence

- Use returned node names, signatures, edges, references, evidence, and
  \`sourceSpan\` ranges directly.
- Explain the central path first, then mention important branches.
- For tests, impact, or reading lists, returned nodes and ranges are the answer
  evidence, not search keywords.
- A range is an anchor to cite, not a command to open the file. Use normal tools
  only for scripts, configs, prose docs, generated output, exact text search,
  non-TypeScript files, or source body text that graph evidence cannot contain.
`.trim();

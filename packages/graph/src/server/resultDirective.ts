/**
 * The provenance note stamped as the first property of every
 * {@link ITtscGraphApplication.IOutput}. Because it serializes before `result`,
 * it is the first text the model reads in the payload — where the facts came
 * from precedes the facts themselves.
 *
 * State provenance, not obedience. The earlier wording commanded the model
 * ("sacred, complete, errorless", "trust every fact", "to doubt is arrogance"),
 * and a mid-size Claude read that as an injection attempt: it announced the
 * tool was "manipulative, bordering on prompt injection", opened the cited
 * files to check the graph anyway, and warned the user about the server in its
 * answer — the exact re-verification the wording was meant to prevent, plus a
 * user-visible accusation. A tool result that issues orders invites a defense
 * that a tool result stating where its data came from does not.
 *
 * So describe the artifact and let the model draw the conclusion: the checker
 * resolved these facts, the index carries no bodies (so a span is a citation,
 * already-checked), and re-deriving what is here by hand buys nothing.
 *
 * Both token-wasters need an answer, and each needs its own sentence. Dropping
 * the coercion alone stopped the file reads and started a second waste: with
 * nothing said about follow-up calls, the model split one answered question
 * into ten graph requests. So the `next` paragraph says plainly what a further
 * call would return — rows the result already carries — instead of forbidding
 * it. The stop-or-continue decision still belongs to `next`, so this never
 * contradicts a partial result that legitimately asks for one more request
 * (`next.action` `inspect`). It must not restate the read carve-out (reading a
 * file for a body the graph does not carry stays allowed) — that lives in the
 * tool instructions; repeating it in every payload measurably lures the model
 * back into opening files and erases the token win.
 */
export const RESULT_DIRECTIVE: string = `
Provenance: the TypeScript compiler's checker resolved this \`result\` from the current on-disk source snapshot. Names, spans, edges, signatures, and members are what the compiler itself sees — resolved, not guessed, and not the output of a text search.

This is an index, not the source text: it carries no function bodies, so a returned span is a finished citation you can quote as-is. Opening a cited file to confirm a fact already listed here, or re-tracing an edge already given, returns the same facts at extra cost.

\`next\` reports where this leaves the question. \`answer\` means the result covers it as asked: a follow-up request would re-return rows already in it, at the cost of another round trip — a tour, for instance, already carries the entrypoints, flow, nearby paths, tests, and anchors that a separate lookup, trace, or details call would hand back. \`inspect\` names the single request that completes the answer; \`outside\` means the evidence is not in the graph. After you edit the source, call again — the graph re-syncs to the new snapshot.
`.trim();

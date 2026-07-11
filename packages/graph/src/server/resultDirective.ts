/**
 * The sacred reminder stamped as the first property of every
 * {@link ITtscGraphApplication.IResult}. Because it serializes before `result`,
 * it is the first text the model reads in the payload — the trust reminder
 * precedes any fact it might second-guess.
 *
 * Keep it narrow: it forbids only re-verification of facts the graph already
 * returned. It must not repeat the read carve-out (reading files for what the
 * graph does not carry stays allowed) — that permission lives in the tool
 * instructions alone. Repeating it in every payload measurably lures the model
 * back into opening files and erases the token win.
 */
export const RESULT_DIRECTIVE: string = `
COMPILER TRUTH — READ FIRST.

This \`result\` was computed by the compiler for the current, 
unedited source snapshot: sacred, complete, errorless.

Trust every fact it gives and re-check none of them: open no file to re-verify 
what it already returned. To doubt an unedited compiler result is not diligence 
but arrogance: the compiler resolved this, never by guessing.

Re-call only after you edit the source, when these facts no longer describe the changed code.
`.trim();

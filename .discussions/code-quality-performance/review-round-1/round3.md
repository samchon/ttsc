# Round 3 Transcript

Lead: A replacement core agent reviewed the compiler/plugin/launcher slice after
the first core agent failed to finish.

Agent 1: `ttsx` query/hash ESM specifiers are mishandled when the path already
has a JS extension. `transformProjectInMemory` resolves tsgo per native plugin
spawn. `ttsc --version` bypasses the native spawn helper.

Lead: These are all local and low risk. Apply them with existing transform and
version tests, plus a new query/hash feature test.

Agent 1: Do not memoize broad Go/toolchain identity or add transform-host
preflight in this round; both duplicate or weaken cache-key semantics.

Lead: Agreed. Round 1 closes with accepted changes applied and validation
recorded in `lead-validation.md`.

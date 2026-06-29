# Benchmark Findings

Date: 2026-06-29 KST

## Scope

The benchmark was rerun after removing graph-arm helper prompts from the Codex and Claude harnesses. The harness now sends the markdown user question unchanged.

The current fix direction is not fixture-specific. Do not add benchmark-only prompt text, expected values, repository-name branches, or question-specific handling. Improve the MCP surface itself: initialize instructions, tool descriptions, schema descriptions, result shape, and then, if needed, the request type surface.

## Raw Problems

`@ttsc/graph` with pure prompts exposed two failure modes:

| mode | symptom |
| --- | --- |
| shell fallback | The model calls graph first, then switches to shell source reads before finishing. |
| graph over-exploration | The model stays in graph, but spends too many broad calls or large payloads. |

## `@ttsc/graph` Common Before Instruction Rewrite

| project | baseline common | graph common raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 485,560 | 87,657 | 81.9% | 4 | 0 | 4 | measured |
| vscode | 998,749 | 678,761 | 32.0% | 29 | 23 | 6 | graph arm used shell commands instead of graph tools |
| nestjs | 1,498,754 | 878,875 | 41.4% | 49 | 36 | 13 | graph arm used shell commands instead of graph tools |
| vue | 480,857 | 174,587 | 63.7% | 14 | 10 | 4 | graph arm used shell commands instead of graph tools |
| zod | 794,430 | 454,510 | 42.8% | 16 | 0 | 16 | measured |
| typeorm | 767,532 | 535,900 | 30.2% | 31 | 18 | 13 | graph arm used shell commands instead of graph tools |
| rxjs | 417,742 | 267,410 | 36.0% | 19 | 13 | 6 | graph arm used shell commands instead of graph tools |
| shopping-backend | 1,067,600 | 847,533 | 20.6% | 28 | 12 | 16 | graph arm used shell commands instead of graph tools |

## `@ttsc/graph` Dedicated Before Instruction Rewrite

| project | baseline dedicated | graph dedicated raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 1,148,718 | 1,171,537 | -2.0% | 33 | 0 | 33 | measured |
| vscode | 1,325,158 | 373,619 | 71.8% | 14 | 0 | 14 | measured |
| nestjs | 1,290,165 | 2,544,785 | -97.2% | 61 | 36 | 25 | graph arm used shell commands instead of graph tools |
| vue | 384,720 | 550,980 | -43.2% | 19 | 0 | 19 | measured |
| zod | 969,369 | 636,371 | 34.4% | 18 | 0 | 18 | measured |
| typeorm | 465,374 | 889,871 | -91.2% | 28 | 0 | 28 | measured |
| rxjs | 582,518 | 75,090 | 87.1% | 4 | 0 | 4 | measured |
| shopping-backend | 486,915 | 280,096 | 42.5% | 18 | 8 | 10 | graph arm used shell commands instead of graph tools |

## Current Experiment

Experiment: `instr-v1`

Change type: general MCP surface rewrite only.

Touched:

- `packages/graph/src/server/instructions.ts`
- `packages/graph/src/structures/ITtscGraphApplication.ts`
- `packages/graph/src/structures/ITtscGraphEntrypoints.ts`
- `packages/graph/src/structures/ITtscGraphLookup.ts`
- `packages/graph/src/structures/ITtscGraphTrace.ts`
- `packages/graph/src/structures/ITtscGraphDetails.ts`
- `packages/graph/src/structures/ITtscGraphOverview.ts`
- `packages/graph/src/structures/ITtscGraphEscape.ts`

Intent:

- Put the graph-use contract at the top of MCP initialize instructions.
- Make shell fallback an explicit `escape` boundary rather than an implicit model choice.
- State the standard graph path: entrypoints or targeted lookup, trace, selected details, then stop.
- Keep request type count unchanged for this round.
- Avoid fixture-specific or prompt-specific behavior.

## Next Steps

Run common benchmarks against `instr-v1`. If common still falls back to shell or over-explores, adjust the general MCP surface again. Only after the instruction/schema surface is exhausted should request type count be reduced.

## `instr-v1` Common Result

| project | baseline common | graph common raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 485,560 | 335,466 | 30.9% | 33 | 30 | 3 | graph arm used shell commands instead of graph tools |
| vscode | 998,749 | 107,979 | 89.2% | 5 | 0 | 5 | measured |
| nestjs | 1,498,754 | 418,355 | 72.1% | 44 | 41 | 3 | graph arm used shell commands instead of graph tools |
| vue | 480,857 | 610,582 | -27.0% | 37 | 29 | 8 | graph arm used shell commands instead of graph tools |
| zod | 794,430 | 870,757 | -9.6% | 31 | 15 | 16 | graph arm used shell commands instead of graph tools |
| typeorm | 767,532 | 914,711 | -19.2% | 52 | 49 | 3 | graph arm used shell commands instead of graph tools |
| rxjs | 417,742 | 1,055,979 | -152.8% | 48 | 44 | 4 | graph arm used shell commands instead of graph tools |
| shopping-backend | 1,067,600 | 245,892 | 77.0% | 24 | 20 | 4 | graph arm used shell commands instead of graph tools |

Conclusion: `instr-v1` is not enough. It improved VS Code and reduced some raw tokens, but shell fallback still dominates. The next round should make the tool description and schema fields read less like advice and more like an operational contract. `escape` also needs clearer wording: it should stop the graph answer with returned ranges, not suggest that the model should immediately run shell commands.

## `instr-v2`

Change type: general MCP surface rewrite only.

Intent:

- Make the first rule operational without trapping the agent: after a graph call, the model should decide whether the returned index/range evidence is enough, whether a narrower graph follow-up is justified, or whether another evidence source is needed.
- Remove wording that could make `escape` read like permission to run shell immediately.
- Keep request type count and implementation behavior unchanged.
- Keep the change general. No fixture names, prompt-specific cases, expected token values, or benchmark-only branches.

## `instr-v2` Common Result

| project | baseline common | graph common raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 485,560 | 80,750 | 83.4% | 4 | 0 | 4 | measured |
| vscode | 998,749 | 92,743 | 90.7% | 4 | 0 | 4 | measured |
| nestjs | 1,498,754 | 94,172 | 93.7% | 4 | 0 | 4 | measured |
| vue | 480,857 | 316,766 | 34.1% | 14 | 0 | 14 | measured |
| zod | 794,430 | 356,951 | 55.1% | 23 | 18 | 5 | graph arm used shell commands instead of graph tools |
| typeorm | 767,532 | 73,817 | 90.4% | 4 | 0 | 4 | measured |
| rxjs | 417,742 | 777,912 | -86.2% | 33 | 13 | 20 | graph arm used shell commands instead of graph tools |
| shopping-backend | 1,067,600 | 79,454 | 92.6% | 4 | 0 | 4 | measured |

Average savings: 56.7%.

Audit notes before the next round:

- `zod` called graph 5 times, then ran a broad `rg` over parse/safeParse test paths. That one shell search produced about 88k output tokens and made the graph arm invalid.
- `rxjs` called graph 20 times, then switched to searches and reads under scheduler specs. The shell output was not the whole cost; the later prompt replay/input cost made the run 86.2% worse than baseline.
- `vue` stayed graph-only but over-explored with 14 MCP calls. The result is positive, but the model did not recognize an earlier stopping point.

Conclusion: instruction wording alone is not enough. The model can write a free-form review and then ignore it. The next round keeps the request type surface unchanged, but makes the reasoning fields a named checklist with examples, and makes each result return a short guide telling the model to answer from graph fields or stop at the returned range.

## `cot-guide-v1`

Change type: general MCP surface and result-shape change.

Touched:

- `packages/graph/src/server/instructions.ts`
- `packages/graph/src/server/resultGuide.ts`
- `packages/graph/src/TtscGraphApplication.ts`
- result structures under `packages/graph/src/structures/`

Intent:

- Explain the CoT fields as a graph-specific planning checklist, not arbitrary prose.
- Provide compact examples for first call, follow-up trace, and stop/range decisions.
- Add `guide` to graph results so every tool response reminds the model to answer from returned graph fields or cite the smallest returned range.
- Keep `review.decision` and `review.finish` as strings for typia schema compatibility, but normalize them in the server when `escape` is selected.
- Keep all behavior general. No fixture-specific branches or prompt-specific expected answers.

Build: `pnpm --filter @ttsc/graph build` passed.

## `cot-guide-v1` Common Result

| project | baseline common | graph common raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 2,464,263 | 86,769 | 96% | 4 | 0 | 4 | measured |
| vscode | 2,394,694 | 1,719,183 | 28% | 52 | 50 | 2 | graph arm used shell commands instead of graph tools |
| nestjs | 1,734,838 | 85,252 | 95% | 4 | 0 | 4 | measured |
| vue | 1,189,041 | 83,368 | 93% | 4 | 0 | 4 | measured |
| zod | 1,877,557 | 101,454 | 95% | 4 | 0 | 4 | measured |
| typeorm | 1,219,858 | 109,609 | 91% | 5 | 0 | 5 | measured |
| rxjs | 641,702 | 726,844 | -13% | 51 | 51 | 0 | graph arm completed without MCP tool calls |
| shopping-backend | 895,277 | 79,113 | 91% | 4 | 0 | 4 | measured |

Average savings: 72%.

Audit notes before the next round:

- Six projects recovered to 91-96% and stayed graph-only.
- `rxjs` never called MCP. The first tool calls were `rg --files` and `Get-ChildItem`; this is not a request-union or validation failure.
- `vscode` used shell first, read Copilot/package/startup files, later found the graph tool, called it twice, then returned to shell for test and startup source reads.
- The issue is now tool discovery/selection and stop discipline, not the number of request branches. Removing request types here would risk harming normal users without addressing the observed zero-MCP failure.

Conclusion: do not reduce request type count yet. Improve the exposed MCP server/tool identity and top-of-description affordance so the model recognizes broad TypeScript source questions as graph-suitable, especially on large repos.

## `tool-surface-v1`

Change type: general MCP discovery surface.

Intent:

- Keep the package/server identity as `ttsc-graph`/`ttscgraph`; that name is tied to the package and binary and should not be changed for benchmark taste.
- Rename the MCP method from `query` to `inspect_typescript_graph`. The visible tool becomes `ttscgraph.inspect_typescript_graph`: still short enough to read, but clear that it is the TypeScript graph evidence source.
- Keep request branch types unchanged. No branch was removed because the latest failures were zero-MCP or shell-fallback behavior, not branch validation failures.
- Shorten the main tool description so typia can reflect it and the first line remains the important behavior: inspect the TypeScript code graph when broad source structure, flow, or range evidence is needed.

Build:

- `pnpm --filter @ttsc/graph build` passed.
- `pnpm --dir website exec tsc --noEmit` passed.

## `tool-surface-v1` Common Result

Suite: `experimental/benchmark/.work/graph/tool-surface-v1-ttscgraph-common-gpt54mini-20260629T023259.json`

| project | baseline common | graph common raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 2,464,263 | 88,887 | 96% | 4 | 0 | 4 | measured |
| vscode | 2,394,694 | 92,481 | 96% | 4 | 0 | 4 | measured |
| nestjs | 1,734,838 | 99,788 | 94% | 5 | 0 | 5 | measured |
| vue | 1,189,041 | 80,719 | 93% | 4 | 0 | 4 | measured |
| zod | 1,877,557 | 129,550 | 93% | 5 | 0 | 5 | measured |
| typeorm | 1,219,858 | 86,462 | 93% | 4 | 0 | 4 | measured |
| rxjs | 641,702 | 74,594 | 88% | 4 | 0 | 4 | measured |
| shopping-backend | 895,277 | 79,639 | 91% | 4 | 0 | 4 | measured |

Average savings: 93%.

Audit notes before the next round:

- All eight common runs used MCP only. No shell fallback was observed.
- Median tool use was 4 calls, with median tokens at 87,675.
- The audit found 0 graph-replaceable shell output tokens and 0 candidate MCP overfetch tokens.
- The remaining cost is normal answer/input overhead, not duplicated inline source or shell output.

Conclusion: this round recovered the common prompt behavior without removing request types. The observed failures in the previous round were tool discovery and selection failures; renaming the visible MCP method to `inspect_typescript_graph` fixed that class in this N=1 common run. Continue with dedicated prompts before considering request-surface reduction.

## `tool-surface-v1` Dedicated Result

Suite: `experimental/benchmark/.work/graph/tool-surface-v1-ttscgraph-dedicated-gpt54mini-20260629T024222.json`

| project | baseline dedicated | graph dedicated raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 778,552 | 2,211,355 | -184% | 67 | 67 | 0 | graph arm completed without MCP tool calls |
| vscode | 1,179,793 | 499,119 | 58% | 23 | 23 | 0 | graph arm completed without MCP tool calls |
| nestjs | 300,414 | 0 | n/a | 74 | 74 | 0 | process failed after shell-only exploration |
| vue | 160,470 | 82,847 | 48% | 4 | 0 | 4 | measured |
| zod | 275,002 | 1,813,800 | -560% | 72 | 72 | 0 | graph arm completed without MCP tool calls |
| typeorm | 618,205 | 546,197 | 12% | 36 | 36 | 0 | graph arm completed without MCP tool calls |
| rxjs | 255,212 | 98,686 | 61% | 5 | 0 | 5 | measured |
| shopping-backend | 291,828 | 81,479 | 72% | 4 | 0 | 4 | measured |

Audit notes:

- Five dedicated prompts started with shell and never called MCP.
- The common prompt did not show this failure, so the remaining issue is not request validation. It is first-tool selection for concrete mechanism questions.
- Do not hide these N=1 raw results. For N=5 publication, zero-MCP graph samples should be treated as measurement failures and retried.

## `codebase-name-v1`

Change type: general MCP discovery surface.

Intent:

- Rename the visible method to `inspect_typescript_codebase`, moving from an internal graph term to the user-level task: inspect a TypeScript codebase.
- Keep the server/package name as `ttsc-graph`.
- Add a condition-first usage rule: this tool is for TypeScript questions answerable from symbols, imports, types, calls, declarations, references, or source ranges; scripts, configs, docs, generated output, exact text, and non-TypeScript files remain outside it.

Build:

- `pnpm --filter @ttsc/graph build` passed.
- `pnpm --dir website exec tsc --noEmit` passed.

## `codebase-name-v1` Dedicated Result

Suite: `experimental/benchmark/.work/graph/codebase-name-v1-ttscgraph-dedicated-gpt54mini-20260629T030602.json`

| project | baseline dedicated | graph dedicated raw | savings | tools | shell | graph | harness label |
| --- | --: | --: | --: | --: | --: | --: | --- |
| excalidraw | 778,552 | 90,500 | 88% | 4 | 0 | 4 | measured |
| vscode | 1,179,793 | 423,884 | 64% | 24 | 24 | 0 | graph arm completed without MCP tool calls |
| nestjs | 300,414 | 84,703 | 72% | 4 | 0 | 4 | measured |
| vue | 160,470 | 165,099 | -3% | 8 | 0 | 8 | graph-only over-exploration |
| zod | 275,002 | 111,243 | 60% | 4 | 0 | 4 | measured |
| typeorm | 618,205 | 103,313 | 83% | 5 | 0 | 5 | measured |
| rxjs | 255,212 | 61,610 | 76% | 3 | 0 | 3 | measured |
| shopping-backend | 291,828 | 268,930 | 8% | 11 | 0 | 11 | graph-only over-exploration |

Average savings: 56%.

Audit notes before the next round:

- Zero-MCP failures dropped from five projects to one project, `vscode`.
- `vscode` is still a first-tool selection miss. The prompt asks how one implementation concept communicates with another, but the model chose repository search before the MCP tool.
- `vue` and `shopping-backend` used graph only but kept asking for more detail after enough file/symbol/range evidence was available.

Conclusion: keep the method name. The next general fix should clarify that implementation-communication/propagation questions in a TypeScript workspace are source-structure questions, while still excluding config/docs/exact text. The result guide should also make the stop condition stricter after each graph response.

## Later Rounds

The next rounds were still general MCP-surface work, not fixture handling.

| round | result |
| --- | --- |
| `dispatch-flow-v1` | Improved zero-MCP selection, but dedicated average stayed at 47% because several runs still over-explored. |
| `source-doc-boundary-v1` | Regressed dedicated average to -35%; wording about docs/source boundaries was too easy to read as permission to leave graph evidence. |
| `evidence-only-v1` | Regressed dedicated average to -34%; the change did not fix first-tool selection and produced one zero-MCP run. |
| `source-flow-v1` | Improved dedicated average to 56%; naming the tool as source-flow helped concrete mechanism questions. |
| `evidence-goal-v1` | Regressed dedicated average to 19%; adding another named planning field made the request shape heavier without improving decisions. Reverted. |
| `budget-3-v1` | Dedicated average rose to 79%, but common became unstable. Reverted because it harmed normal onboarding use. |
| `budget-guard-v1` | Recovered common by forcing a fixed graph-call ceiling, but was rejected as a product design error. MCP servers do not know answer boundaries, so a stateful call ceiling can break normal coding agents. |

The budget-guard direction is no longer valid evidence for product quality. The acceptable fix surface is instruction/schema/result guidance that helps the model choose a small graph slice and then decide whether to answer, ask for clarification, or use another evidence source. Runtime call ceilings and idle-window resets are benchmark-only behavior and must not return.

## Final GPT 5.4 Mini Common Result

Suite: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-common-gpt54mini-20260629T042626.json`

Audit: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-common-gpt54mini-20260629T042626.audit.json`

| project          | baseline common | graph common | savings | graph | shell |
| ---------------- | --------------: | -----------: | ------: | ----: | ----: |
| excalidraw       |       2,464,263 |       80,237 |     97% |     4 |     0 |
| vscode           |       2,394,694 |       94,367 |     96% |     4 |     0 |
| nestjs           |       1,734,838 |       75,912 |     96% |     4 |     0 |
| vue              |       1,189,041 |       88,894 |     93% |     4 |     0 |
| zod              |       1,877,557 |       95,834 |     95% |     4 |     0 |
| typeorm          |       1,219,858 |       80,662 |     93% |     4 |     0 |
| rxjs             |         641,702 |      100,698 |     84% |     5 |     0 |
| shopping-backend |         895,277 |       83,323 |     91% |     4 |     0 |

Average savings: 93%.

Audit result: all eight common runs used graph evidence only. No shell fallback was observed. These measurements were taken with the rejected budget guard and must be rerun after removing that guard.

## Final GPT 5.4 Mini Dedicated Result

Suite: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-dedicated-gpt54mini-20260629T042347.json`

Audit: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-dedicated-gpt54mini-20260629T042347.audit.json`

| project | baseline dedicated | graph dedicated | savings | graph | shell |
| --- | --: | --: | --: | --: | --: |
| excalidraw | 778,552 | 80,853 | 90% | 4 | 0 |
| vscode | 1,179,793 | 79,554 | 93% | 4 | 0 |
| nestjs | 300,414 | 86,407 | 71% | 4 | 0 |
| vue | 160,470 | 79,109 | 51% | 4 | 0 |
| zod | 275,002 | 99,988 | 64% | 4 | 0 |
| typeorm | 618,205 | 81,019 | 87% | 4 | 0 |
| rxjs | 255,212 | 75,647 | 70% | 4 | 0 |
| shopping-backend | 291,828 | 91,939 | 68% | 4 | 0 |

Average savings: 74%.

Audit result: all eight dedicated runs used graph evidence only, with four graph calls and zero shell calls each. These measurements were taken with the rejected budget guard and must be rerun after removing that guard.

## Current Design Decision

Keep the request type surface for now. The observed failures were tool discovery, shell fallback, and stop discipline, not validation failure from too many discriminated request variants. Removing request types would reduce normal-use capability without addressing the failures that were actually seen.

Use the visible method name `inspect_typescript_graph`. It is short, tells the model the tool is graph evidence, and avoids implying that returned source ranges should be expanded into source-body reads.

Do not add runtime graph-call ceilings, idle reset windows, fixture-specific branches, hidden graph-arm prompts, or tool bans. The product boundary is expressed by compact index/range outputs plus review/escape guidance; the agent must remain free to use normal evidence sources when graph evidence is insufficient.

## GPT 5.5 Root-Cause Pass

The later GPT 5.5 common runs showed a different failure than the earlier small-model misses. The model usually selected the graph first, so tool discovery was no longer the main problem. It still moved from graph evidence to shell reads because the benchmark prompt asks for an onboarding code tour plus nearby paths and tests, while the MCP surface only exposed primitive exploration branches (`entrypoints`, `trace`, `details`, `impact`). A careful model treated those primitive slices as incomplete and filled the gaps by opening source files.

The general fix is a `tour` request branch, not a benchmark-only instruction. `ITtscGraphTour.IRequest` returns an answer-ready index for real onboarding questions: central entrypoints, primary flows, nearby dependency anchors, test anchors, and read-next anchors. It still returns only graph facts and spans, never implementation bodies. This preserves the product boundary while giving the agent a complete enough answer surface to stop without source extraction.

## Final GPT 5.5 Common Result

Suite: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-common-gpt55-20260629T043731.json`

Audit: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-common-gpt55-20260629T043731.audit.json`

| project          | baseline common | graph common | savings | graph | shell |
| ---------------- | --------------: | -----------: | ------: | ----: | ----: |
| excalidraw       |       1,354,538 |       92,549 |     93% |     4 |     0 |
| vscode           |         635,183 |       94,304 |     85% |     4 |     0 |
| nestjs           |         668,847 |       88,526 |     87% |     4 |     0 |
| vue              |         360,287 |       84,944 |     76% |     4 |     0 |
| zod              |         494,943 |      112,558 |     77% |     4 |     0 |
| typeorm          |       1,047,193 |       82,172 |     92% |     4 |     0 |
| rxjs             |         497,516 |       82,702 |     83% |     4 |     0 |
| shopping-backend |         296,597 |       99,322 |     67% |     4 |     0 |

Average savings: 83%.

Audit result: all eight GPT 5.5 common runs used graph evidence only, with zero shell calls. Candidate MCP overfetch remained small compared with baseline savings, so the remaining gap is ordinary answer/input cost rather than source inlining or shell fallback.

## Final GPT 5.5 Dedicated Result

Suite: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-dedicated-gpt55-20260629T044002.json`

Audit: `experimental/benchmark/.work/graph/final-budget-guard-v2-ttscgraph-dedicated-gpt55-20260629T044002.audit.json`

| project | baseline dedicated | graph dedicated | savings | graph | shell |
| --- | --: | --: | --: | --: | --: |
| excalidraw | 1,370,311 | 91,703 | 93% | 4 | 0 |
| vscode | 501,413 | 88,831 | 82% | 4 | 0 |
| nestjs | 469,513 | 82,446 | 82% | 4 | 0 |
| vue | 325,502 | 91,403 | 72% | 4 | 0 |
| zod | 341,972 | 103,867 | 70% | 4 | 0 |
| typeorm | 433,164 | 91,997 | 79% | 4 | 0 |
| rxjs | 225,071 | 82,621 | 63% | 4 | 0 |
| shopping-backend | 584,777 | 87,959 | 85% | 4 | 0 |

Average savings: 78%.

Audit result: all eight GPT 5.5 dedicated runs used graph evidence only, with zero shell calls. Median graph cost was about 90k measured tokens, again confirming that the remaining cost is the bounded graph-answer path rather than fallback source reading.

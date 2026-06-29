# Graph MCP Contract

Read this before changing `packages/graph`, graph benchmark prompts, graph benchmark runners, or the graph benchmark website.

## Product

`@ttsc/graph` is a compiler-derived TypeScript index for coding agents. It should expose declarations, signatures, relationships, decorators, tests, and source spans from the resident `Program` and `TypeChecker`. It must not inline implementation bodies. When source text is needed, return the smallest span and let the agent read it normally.

Code inlining is not an acceptable product option. Similar graph-memory tools such as `codegraph` and `codebase-memory-mcp` showed the failure mode: once tool output includes source bodies, large projects can explode into huge tool output, prompt replay, redundant follow-up calls, and negative token savings. `@ttsc/graph` must avoid that class of failure by staying an index with spans.

## Prohibited

Do not hardcode fixture names, repository names, model names, prompt text, expected answers, token targets, file names, package names, or tool-call counts. Do not add caps, cooldowns, idle resets, forced first calls, or any control hack that makes Codex, Claude Code, or another real coding agent worse.

Do not validate answer quality with free-text checks. Matching words, phrases, regexes, or final-response content is hardcoding and benchmark contamination. The harness may record numeric observations such as tokens, tool calls, shell reads, MCP calls, and durations. Humans inspect quality.

## Schema And Prompt

MCP returns must stay typed and structured. Request and result union members should pair naturally as `ITtscGraphX.IRequest` and `ITtscGraphX`. Use short discriminators, clear field comments, and typed decision fields instead of prose-only rules.

The tool must be CoT-compliant: the schema should make the agent state the smallest graph need, review whether the draft is still useful, and escape when graph evidence is enough or the next evidence is outside the graph. Do not force graph use when normal coding-agent behavior is the right next step.

The MCP instruction's first 512 characters must say what the tool is, when to use it, and why compiler-derived graph facts are trustworthy. Keep the prompt readable, concise, non-contradictory, and Markdown-structured. State when to use graph first, when to answer from returned graph fields, and when to escape for source body text or non-graph evidence.

## Benchmarks

Common prompts must remain natural onboarding or architecture questions. Dedicated prompts may be project-specific, but still plausible. Never append graph-specific hidden guidance to user prompts, and never optimize by making the product worse outside the benchmark.

Optimize in this order: instruction clarity, schema clarity, graph result quality, then tool-shape reduction only if the removed shape is not generally useful. Treat negative savings as a trace-analysis signal, not as a reason to add benchmark-only logic.

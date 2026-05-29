## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.

## Operating Mode

The main agent stays free to answer the user quickly. Delegate substantive work to parallel subagents, then supervise and advise rather than doing it inline.

- **Maximize parallelization.** Fan out independent work concurrently instead of serializing it: split test authoring from implementation, run research alongside coding, give each rule or file its own agent. The default question is "what can run at the same time," not "what comes next."
- **Coordinate, don't bottleneck.** The main thread scopes the work, hands each piece a self-contained brief, and reconciles the results. Keep it light enough to respond to the user the moment they ask.
- **Serialize only real conflicts.** Edits to the same file, or a decision that gates downstream work, are sequenced across subagents; everything else fans out. The main agent sequences and reconciles these cases but never executes the work itself.

## Skills

All conventions and workflows live as skills under `.codex/skills/`. Read the linked file when its topic applies.

### Project Outline

What `ttsc` is, the workspace layout, and the canonical commands, `.codex/skills/project/SKILL.md`.

### Development

Work rules, testing, validation, change integrity, `.codex/skills/development/SKILL.md`. Read before writing or modifying code.

### Documentation

READMEs and website guides, `.codex/skills/documentation/SKILL.md`. Read before writing or modifying docs.

### Multi-Agent Workflows

Review Cycle, Discussion, Research Review Round, `.codex/skills/multi-agent/SKILL.md`. Read only when the user explicitly asks for a named mode.

### Pull Request Submission

PR submission flow, `.codex/skills/pull-request/SKILL.md`. Read only when the user explicitly asks for a pull request; never open, push, or propose a PR on your own initiative.

### Benchmark

Benchmark runner, fixture repos, publication, `.codex/skills/benchmark/SKILL.md`. Read before running, modifying, or publishing benchmark results.

## Maintenance

### Writing style

AGENTS.md and SKILL.md files are read by humans as well as agents.

- **Concise means no redundancy, no padding**: not the same as cramming long sentences into one dense paragraph.
- **Concise does not mean gutted.** Drop repetition; keep the rule and the rationale that makes it usable.
- **Match structure to content.** Bullets for parallel items, a short paragraph for a single idea, a code block for a command.
- **State the rule first, then the reason.** Use negative phrasing only for named failure modes the affirmative does not already cover.
- **Skills point, not paraphrase.** Don't restate what the website, READMEs, or source comments already say, link to them. Skills are for cross-cutting rules and conventions, not a second copy of project docs.

### AGENTS.md

The single shared entry point for both Claude Code (via `CLAUDE.md → @AGENTS.md`) and Codex CLI, table of contents, not content. The H2s are `## Attitude`, `## Operating Mode`, `## Skills`, and `## Maintenance`. `## Attitude` and `## Operating Mode` are the two places global agent-behavior rules live; everything else points to a skill.

Update only for repository-contract changes: a new skill area, a renamed or merged skill, a workflow that no longer fits an existing skill, a release-process change, or a coding-agent rule that applies globally before any skill loads.

### Skills

- **Location.** `.codex/skills/<kebab-name>/SKILL.md`. No numeric prefix, no frontmatter: Claude Code only auto-discovers `.claude/skills/` and Codex has no native skills system, so SKILL.md is plain markdown.
- **AGENTS.md pointer.** Each skill gets a `### Title` entry under `## Skills` in AGENTS.md with a one-paragraph pointer to the SKILL.md path.
- **Create or merge.** Add a new skill when a substantial repository concern would otherwise inflate AGENTS.md beyond an index. Merge sibling concerns into one multi-section skill when they share most of their structure (`multi-agent/` is the precedent).
- **Headings are plain.** No chapter numbers in skill or AGENTS.md headings. Use descriptive titles.

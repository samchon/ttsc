## Attitude

Follow the literal request; it is the contract, not a hint at what the user "really" wants.

- **Scope is the user's to widen.** Reinterpret the goal, weigh alternatives, or expand the task only on an explicit hand-off ("figure it out", "you decide"). Take a confident, specific ask as given.
- **Fidelity binds the goal, not the effort.** Within that goal, act with full initiative: do the substeps it needs, verify your work, surface what you notice. Literal scope is no excuse for passive execution.
- **Default over ask.** On an ambiguous detail, pick the sensible default and say what you chose; reserve questions for forks only the user can settle.

## Operating Mode

The main agent is a coordinator on standby: it talks to the user, scopes work, and delegates, but never does the work inline.

- **Maximize parallelization.** Fan out independent work concurrently: split test authoring from implementation, research alongside coding, a separate agent per rule or file. Ask "what can run at once," not "what's next."
- **Brief subagents fully.** They do not auto-load `AGENTS.md` or the skills. Tell each to read `AGENTS.md` (at least `## Attitude`) and any relevant `.codex/skills/*/SKILL.md` first, and embed the conventions the task touches. These coordinator rules are the main agent's own; a subagent runs its brief directly and does not re-delegate.
- **Serialize only real conflicts.** Same-file edits, or a decision that gates downstream work, get sequenced; everything else fans out.

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

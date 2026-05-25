## 1. Project

### 1.1. Product Contract

`ttsc` is a standalone TypeScript-Go compiler, runtime, plugin host, and LSP host. It ships three CLIs and a plugin protocol:

- `ttsc` — build, check, watch, and source-to-source transform on top of `@typescript/native-preview`.
- `ttsx` — run a TypeScript entrypoint after a real type-check (a typed `tsx`/`ts-node`).
- `ttscserver` — Language Server Protocol host: wraps the project-selected `tsgo --lsp --stdio` process and proxies JSON-RPC traffic so ttsc plugin diagnostics, code actions, and `workspace/executeCommand` handlers merge into the same stream the editor consumes.
- Plugins — Go sidecars that share TypeScript-Go's AST/Checker. `ttsc` builds plugin source on demand and caches the binary.

The contract is general-purpose. Downstream projects like `typia` and `nestia` are compatibility fixtures, not the product definition.

### 1.2. Layout

- `packages/ttsc`: JS launcher/API plus Go host (`cmd/*`, `driver`, `internal`, `utility`) and `shim/` over TypeScript-Go internals; `internal/lspserver` is the byte-level LSP proxy used by ttscserver, while `driver.PluginSource` remains the public seam downstream pipelines (lint, format, third-party diagnostics) implement (reference client: `packages/vscode`).
- `packages/{banner,paths,strip}`: utility transform plugins with package-owned `driver/` logic linked into a generic native host.
- `packages/lint`: `@ttsc/lint` with its own native engine. Rules may consult the TypeScript-Go Checker directly via `ctx.Checker`; third-party rules ship through the public `rule` package and may use the `rule/astutil` helpers.
- `packages/unplugin`: bundler adapters.
- `packages/vscode`: VSCode extension that wires `vscode-languageclient` to ttscserver and exposes ttsc-owned commands.
- `packages/ttsc-*`: per-platform packages (native helper + bundled Go SDK). Each ships both the `ttsc` helper and the `ttscserver` binary.
- `tests/projects`: project-shaped fixtures copied into temp dirs by `TestProject.copyProject`.
- `tests/test-*`: feature-test packages (run via `pnpm test:features`).
- `tests/utils`: shared helpers (`@ttsc/testing`).
- `tests/<plugin-name>`: workspace packages that need to be `require.resolve`-able from a fixture's `node_modules` (e.g. `tests/lint-contributor-demo`). Built by `scripts/build-current.cjs` before tests run.
- `website`: Nextra-based docs site (`src/content/docs/**/*.mdx`) that is the canonical home for guides — shipped to https://ttsc.dev.
- `config`, `scripts`: shared tsconfig and workspace scripts.

### 1.3. Commands

```bash
pnpm install
pnpm format
pnpm build
pnpm test:go
pnpm test
```

## 2. Development

### 2.1. Work Rules

- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style — don't create parallel structures.
- Respect existing package boundaries. Don't hardcode consumer-specific behavior into the compiler host.
- Plugin descriptors are JS; transform logic is Go. JS transform functions (e.g. `transformSource`, `transformOutput`) are not part of the public contract.
- Plugin configuration lives in dedicated `*.config.{ts,cts,mts,js,cjs,mjs,json}` files, auto-discovered by upward walk; the tsconfig plugin entry accepts only `configFile` (an explicit path). Don't reintroduce inline `compilerOptions.plugins` option keys — they were withdrawn so config has one typed, discoverable home.
- `shim.go` files marked `gen_shims:hand-maintained` are not regenerated.
- When code behavior changes, update the matching page under `website/src/content/docs/` in the same change.

### 2.2. Testing

**One test case per file, named after what it asserts.** Applies to both layers.

- **Go unit tests** live in `packages/*/test/`; one `Test*` per file. Run the real command entrypoint (e.g. `go run ./plugin`) so wrapper branches stay covered.
- **TypeScript e2e tests** live in `tests/test-*/src/features/`. Each file exports exactly one `test_<snake_case>` function with a matching file name; `DynamicExecutor` discovers them by prefix. Materialize a temp project, spawn the real binary, and assert on observable output.

Open every case with a doc comment in the same three-part shape: a one-line `Verifies …` headline, a short paragraph stating the non-obvious *why* (which branch or regression is being pinned), and a 2–4-step numbered list summarizing the scenario.

```ts
/**
 * Verifies plugin corpus: composes rejects cycle between two plugins.
 *
 * Locks the cycle-detection branch in `loadProjectPlugins.ts::composePluginSources`.
 * Composition is one hop only; reciprocal `composes` arrays would silently reswap
 * the binaries of both plugins, so ttsc throws an explicit error instead of
 * routing to the wrong binary.
 *
 * 1. Two plugin descriptors each list the other in `composes`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and `composes cycle detected` in stderr.
 */
export const test_plugin_corpus_composes_rejects_cycle_between_two_plugins =
  () => { /* ... */ };
```

Use the shared helpers in `tests/utils` and the per-suite `internal/` modules; do not reach into another suite's internals. Regressions that need a real directory layout (not just a synthetic temp file map) go under `tests/projects`.

### 2.3. Validation

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

### 2.4. Change Integrity

Treat tests, fixtures, snapshots, CI workflows, package wiring, dependencies, core algorithms, and generated baselines as part of the specification. Changing them requires an explicit user request or a clear product reason, and the final report must call it out.

For mechanical ports, migrations, or broad rewrites, preserve the existing algorithm and public behavior in reviewable slices. Prefer a concrete exemplar over abstract instructions, and inspect the diff before trusting a green test run.

## 3. Documentation

### 3.1. READMEs

README files are for the final reader of that package or directory. Start with what it is, when to use it, installation, the smallest working setup, and the common path.

Keep README language direct and practical. Avoid compiler theory, protocol details, internal architecture, and edge cases unless the reader must know them to use the package. Move deep explanations into the website guides and link them only as the next step.

### 3.2. Guide Documents

Guide documents live under `website/src/content/docs/` as MDX, served by Nextra at https://ttsc.dev. They are the detailed layer. Each guide must name its reader: consumer, package user, bundler user, runtime user, plugin author, or maintainer.

The tree is organized by audience: top-level pages (`setup.mdx`, `why.mdx`, `faq.mdx`, `troubleshooting.mdx`) for cross-cutting tasks, per-package folders (`ttsc/`, `lint/`, `plugins/`, `wasm/`) for package guides, and `development/` for plugin-author guides. Package guides may go deeper than README with full options, recipes, troubleshooting, compatibility notes, and migration details. Plugin-author guides may cover protocol, Go APIs, testing, publishing, and internals. Keep one audience and task per page, and update the matching `_meta.ts` when adding, renaming, or moving a guide.

### 3.3. AGENTS.md Maintenance

Update `AGENTS.md` when the repository contract changes: new package families, moved directories, new commands, testing conventions, documentation policy, release flow, or coding-agent workflow rules.

Keep `AGENTS.md` systematic, natural to read, and concise. Preserve the numbered H2/H3 structure, place new guidance in the smallest fitting section, and prefer direct rules over long rationale.

When adding agent-facing rules, state the desired workflow first. Use negative constraints only for named failure modes, and include the reason so the rule points back to the intended behavior.

## 4. Multi-Agent Workflows

Use these workflows only when the user explicitly asks for the named workflow, a multi-agent review, or a multi-agent discussion. Use Review Cycles for direct review of changed source, docs, and tests; Discussions for open-ended topic exploration; and Research Review Rounds when review needs shared research before individual proposals.

### 4.1. Review Cycles

For an explicitly requested review cycle, form a team of six agents. Each agent must read the changed source, docs, and tests in full, then propose concrete improvements.

The lead agent rechecks every proposal, verifies it against the codebase, and applies only changes that are technically sound and relevant.

That is one cycle. For the next cycle, form a fresh team of six different agents and repeat. Continue while at least one verified proposal is accepted. Stop when no agent proposes an improvement, or when no proposal survives lead-agent validation.

### 4.2. Discussions

For a discussion task, create a new topic directory under `.discussions/<topic>/`. Use a short filesystem-safe topic name. Do not delete or overwrite existing discussion directories unless the user explicitly requests it.

Form a team of six agents. Each agent researches the topic, creates a personal subdirectory under the topic directory, and continuously maintains its own wiki-style knowledge base there.

When all agents are ready, run three unrestricted discussion rounds recorded as `round1.md`, `round2.md`, and `round3.md` in the topic directory. Each round has a one-hour budget. The lead agent moderates, acts as scribe, and does not narrow the topic unless the user did.

The transcript files must record the live discussion, not a retrospective summary. The lead agent writes each statement in speaking order. Team agents read the updated transcript before speaking again and continue researching, revising their own knowledge bases, and preparing notes while waiting for their next turn.

After `round3.md` is complete, the lead agent writes the agreed conclusions and major open points into `summary.md` in the topic directory, reports them to the user, and waits for the next instruction.

### 4.3. Research Review Rounds

For an explicitly requested research review, combine the `.discussions` knowledge-base workflow with the review validation loop.

Create a new topic directory under `.discussions/<topic>/`. Each research review round gets its own `review-round-N/` subdirectory with six fresh agents, agent knowledge-base folders, `round1.md`, `round2.md`, `round3.md`, `proposals.md`, and `lead-validation.md`.

In each round, agents build their own knowledge bases from the changed source, docs, tests, and any relevant research. Run the three live discussion transcripts as in Discussions: the lead agent records statements in speaking order while team agents read each other's statements, keep researching between turns, and refine their notes.

At the end of a round, each agent submits its own concrete improvement proposals. Do not require consensus; discussion is for shared understanding, not voting. The lead agent verifies every proposal and applies only changes that are technically sound and relevant.

For the next round, replace the team with six different agents and repeat. Continue while at least one verified proposal is accepted. Stop when no meaningful proposal remains, or when no proposal survives lead-agent validation.

## 5. Pull Request Submission

When the user explicitly asks for a pull request, follow this flow.

1. Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `ci/<scope>`.

2. Group changes into logical commits — one per coherent unit, not a single mega-commit when the diff is large. Use the repository's existing `<type>(<scope>): <subject>` message style.

3. Write the PR body at open: intent, scope, deferred items, test plan. Treat it as the PR's historical intent statement. Do not rewrite the body on every follow-up push — subsequent CI fixes, newly-found design issues, and deferred-item promotions go in `gh pr comment` instead. The comment thread is the PR's chronology.

4. After every push, watch `gh pr checks <PR>` with the Monitor tool until each check settles. Do not poll manually; the notification arrives when transitions complete. On failure, fetch the job log via `gh api repos/<owner>/<repo>/actions/jobs/<job-id>/logs` (returns the full log when `gh run view --log-failed` is empty), diagnose, fix in place, push as a new commit, and let the monitor resume.

5. The agent does not merge, squash-merge, or rebase the target branch. Hand back to the user when all checks pass — or when the user has acknowledged a known-failing check.

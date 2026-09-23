# Skills And AGENTS.md

Read this document through the documentation skill before writing or changing `AGENTS.md` or anything under `.agents/skills/`. These files are read by Claude Code, by Codex CLI, and by humans. Prose and voice follow [prose.md](prose.md).

## How The Harnesses Load Them

- **`AGENTS.md`** loads at the start of every session. Codex reads it and stops at 32 KiB. Claude Code reads it directly because the repository has no `CLAUDE.md`; a `CLAUDE.md` or `CLAUDE.local.md` would replace it.
- **Codex** scans every `.agents/skills` directory recursively. It lists the `name` and `description` of every `SKILL.md` it finds, shortens descriptions when the list is over budget, and loads a skill's body only when it uses the skill.
- **Claude Code** does not read `.agents/`. It reaches a skill only through the `AGENTS.md` skill index, so an index line is the only trigger it sees.

## Where Content Belongs

- **`AGENTS.md`** holds only what every session needs and the code does not reveal: the product identity, the canonical commands, the global behavior rules under `## Attitude`, the skill index, and the maintenance pointer. Keep it under 200 lines.
- **A skill** owns one job: a procedure or an area of knowledge loaded on demand.
- **A skill is one `SKILL.md` by default.** Split it only when it is too long to read whole and its topics are clearly separate, so a task needs one topic without the others. A split `SKILL.md` becomes the table of contents: each topic is one h2 whose heading links directly to its sibling document, followed by one line saying what it covers.
- **A sibling document** holds one topic. Link it from `SKILL.md` one level deep, and open a document longer than 100 lines with its contents. Extend an existing skill before creating a new one.
- **A README or website guide is linked, never restated.** A skill carries only what an agent needs beyond those documents: its rules, gates, and traps.
- **Add content only for a real need:** a mistake an agent made, a fact the code does not reveal, or a rule the user set. Do not describe what an agent can read from the code, and do not add a rule for a failure nobody has seen.

## Skill File Format

- **One directory per skill:** `.agents/skills/<name>/SKILL.md`. The frontmatter `name` equals the directory name and uses lowercase letters, digits, and single hyphens, at most 64 characters.
- **Vendored skills nest under their host.** `project/evidence` and `benchmark/evidence` come from `samchon/lint-plugin-evidence` and sit one level below the skill that owns their subject, so a re-copy keeps upstream's shape and every relative link inside it. Their `name` is that path, because two skills named `evidence` would collide.
- **Outside the vendored trees, only a skill's entry file is named `SKILL.md`.** Codex registers every `SKILL.md` it finds as a separate skill, so a sibling document uses another name.
- **The `description` is the trigger.** Write it in the third person, at most 1,024 characters. Put the key use case and its trigger words in the first sentence, then when to use the skill, then its exclusions. A harness may cut everything after the first sentence.
- **Keep the index and the description on one scope.** Every skill has one line in the `AGENTS.md` skill index. When the scope changes, correct the description first, then the index line.
- **Keep the file set small.** A skill holds `SKILL.md` and its sibling documents only, with no `agents/openai.yaml` metadata.
- **Write plain headings and portable links.** No chapter numbers, and relative links with forward slashes.

## Writing Rules

- **Give the context needed to act correctly.** Do not make the reader infer prerequisites, exceptions, reasons, or stop conditions to shorten a document; cut what the model already knows instead.
- **State each rule once, at its owning document, and link to it elsewhere.** Before adding or changing a rule, search `AGENTS.md` and `.agents/skills` for the same subject. Make every mention agree, or state the override where it lives and name the rule it replaces. Conflicting guidance makes an agent pause or pick one at random.
- **Leave precedence with the user.** Write a skill procedure as the default the user can change, and never claim that a skill rule outranks the user's explicit instruction. `AGENTS.md` owns that precedence.
- **Separate requirements from defaults.** Write a hard requirement as an unconditional rule, and write a default with its escape, such as "unless the user names another".
- **Add stops only for real risk.** Put a stop, confirmation, or approval step only before an action that is destructive, irreversible, visible outside the checkout, or deliberately protected, and say which. Where a workflow runs on its own, name the stops it wants and the early stops it does not.
- **Name the mode.** A rule that holds only while the user is absent, as in an unattended run, or only while the user is present says so.
- **Leave thinking to the runtime.** Do not tell the agent how much to think, and do not ask it to write out its internal reasoning in the reply. Thinking depth is an effort setting, and a reply that reproduces reasoning can be declined.
- **Prefer a constraint that narrows the work to the task.** "Do not edit code the change does not need" holds an agent to the task; a generic virtue such as "handle edge cases" widens exploration without saying what to check. Write a positive requirement as a concrete, checkable action, and keep the user's explicit quality bar, which already says what to check.
- **Name the concrete pattern a negative rule forbids.** Use a negative rule only when it prevents a failure the affirmative rule does not already exclude. A general instruction to avoid a style only trades one default for another.
- **Match freedom to fragility.** Give exact commands and order where only one sequence is safe, and give outcomes and constraints where the work needs judgment.
- **Use one term per concept** across every skill, and define a term where it first matters.
- **Write the current rule only.** Leave incident stories, dates, and version pins that go stale to git history and to the files that own the pinned value.
- **Structure to compress meaning.** Use ordered lists for procedures, bullets for choices and checks, tables for repeated mappings, and code blocks for exact commands. Use a list only when its items are parallel, sequential, or compared, and nest one only when prose cannot carry the hierarchy. Give each paragraph one job, and state the rule before its reason.

## Maintaining AGENTS.md

`AGENTS.md` is the single shared entry point for Claude Code and Codex. Its H2s are `## Commands`, `## Attitude`, `## Skills`, and `## Maintenance`, and `## Attitude` is the one place global agent-behavior rules live.

Change `AGENTS.md` only for a repository-contract change: a new, renamed, merged, or deleted skill, a changed canonical command, a release-process change, or a behavior rule that applies before any skill loads.

## Verifying A Change

1. Search `AGENTS.md` and `.agents/skills` for every mention of the changed subject, and leave one owner with links elsewhere.
2. Check the mechanics: each `SKILL.md` `name` matches its path below `.agents/skills/`, every relative link and anchor resolves, and `AGENTS.md` stays under 200 lines.
3. Run `pnpm format`.
4. Watch a fresh session, one with no history of the change, do a real task the change targets. Note whether it finds the rule through the index or description, opens the right sibling document, and follows the rule. ttsc has no evaluation suite for its instructions, so this observation is the test.

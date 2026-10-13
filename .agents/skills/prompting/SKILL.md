---
name: prompting
description: Writes and trims ttsc's prompts for agents, namely AGENTS.md, CLAUDE.md, and the skills under .agents/skills. Use before changing any of them, together with the documentation skill's writing rules.
---

# Prompting

A prompt follows the documentation skill's Writing and Paragraphs And Lists rules. This skill adds what an agent reader running Claude Opus 5.5 needs.

## Before Editing

Fetch and read these pages in full rather than relying on memory, because they change with each model:

- [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
- [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), the general techniques it defers to
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

Apply what they say for Opus 5.5 and all current models, and drop guidance written for an earlier model.

## Content

- Write only facts the code does not show, rules the user set, and mistakes an agent made; Claude already knows general engineering. Leave dates and history to git.
- Give the reason behind a rule when it is not obvious, so the agent can generalize from it.
- Do not tell the agent how much to think, since effort sets that, and never ask for its reasoning in the output.
- Match detail to fragility: exact commands where only one sequence is safe, goals and constraints where judgment works, and one default instead of a menu.
- Give a long task its completion condition and a task list to keep, name the early stops to avoid and the stops that are wanted, and keep a confirmation before risky or irreversible actions.
- For loosely specified work, name the sources to read before acting, including ones the request does not mention.

## Layout

- `AGENTS.md` holds what every session needs, under 200 lines, and lists every skill, because Claude Code finds skills only there. `CLAUDE.md` is `@AGENTS.md`.
- A skill is `.agents/skills/<name>/SKILL.md` with `name` equal to the directory and a third-person `description` saying what it does and when to use it.
- `SKILL.md` is the overview. Move a branch that only some tasks need into a sibling file linked directly from it, add a table of contents to a file over 100 lines, give a job with its own trigger its own skill, and never nest skills.

## Verification

Check that links resolve and each rule has one owner. Then give a fresh session a real task the change governs, watch which files it opens and whether it follows the rule, and revise from what it actually did.

---
name: prompting
description: Writes and trims ttsc's prompts for agents, namely AGENTS.md, CLAUDE.md, and the skills under .agents/skills. Use before changing any of them, together with the documentation skill's writing rules.
---

# Prompting

A prompt follows the [documentation skill](../documentation/SKILL.md)'s Writing and Paragraphs And Lists rules. Before editing one, fetch and read [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) in full rather than relying on memory, because it changes with each model. Where it disagrees with the user's rules in this repository, the user's rules win.

Write only facts the code does not show, rules the user set, and mistakes an agent made, and leave dates and history to git.

## Layout

- `AGENTS.md` holds what every session needs, under 200 lines, and lists every skill, because Claude Code finds skills only there. `CLAUDE.md` is `@AGENTS.md`.
- A skill is `.agents/skills/<name>/SKILL.md` with `name` equal to the directory and a third-person `description` saying what it does and when to use it.
- `SKILL.md` is the overview. Move a branch that only some tasks need into a sibling file linked directly from it, give a job with its own trigger its own skill, and never nest skills.

## Verification

Check that links resolve and each rule has one owner. Then give a fresh session a real task the change governs, watch which files it opens and whether it follows the rule, and revise from what it actually did.

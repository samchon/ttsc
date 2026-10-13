---
name: documentation
description: Writes and trims everything ttsc publishes as prose, namely prompts for agents (AGENTS.md, CLAUDE.md, and skills), READMEs, and website guides. Use before writing or changing any of them; checklist questions belong to contracts.
---

# Documentation

Good writing is the same for every reader: deliver the core point concisely and clearly. Only the reader, and so what the reader needs, differs by document.

## Writing

- Write only what the reader needs and would not otherwise know. Cut padding, repetition, preamble, filler, and closing summaries; completeness means covering what the reader needs, never longer phrasing.
- One point, one sentence, one place. Give the reason when it is not obvious.
- Say what to do rather than what to avoid; when a prohibition is needed, name the concrete pattern.
- Plain English with one term per concept, and no emphasis capitals, em-dashes, emoji in prose, promotional adjectives, stock AI phrasing, hedging, dates, or history.

## Paragraphs And Lists

A paragraph is one topic. Start a new one when the topic changes and keep sentences on the same topic together; merging topics to save paragraphs and splitting every sentence are both failures. Write each paragraph on one source line.

Use a list for parallel items, for steps whose order changes the result, and for their sub-steps, marking a sublist differently from its parent, such as `-` items under a numbered list. Write an argument whose conditions, reasons, and exceptions depend on each other as prose. Use a table for repeated mappings and a code block for exact commands.

## Prompts

`AGENTS.md`, `CLAUDE.md`, and skills are read by an agent running Claude Opus 5.5. Follow Anthropic's [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5), the [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) it defers to, and the [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), never guidance written for an earlier model.

- Claude already knows general engineering, so keep only facts the code does not show, rules the user set, and mistakes an agent made.
- Never ask for reasoning in the output; effort, not the prompt, sets how much the model thinks.
- Give exact commands only where one sequence is safe, and one default instead of a menu.
- Give a long task its completion condition, and name the early stops to avoid and the stops that are wanted.
- `AGENTS.md` holds what every session needs, under 200 lines, and lists every skill, because Claude Code finds skills only there. `CLAUDE.md` is `@AGENTS.md`.
- A skill is `.agents/skills/<name>/SKILL.md` with `name` equal to the directory and a third-person `description` of what it does and when to use it. `SKILL.md` is the overview; move a branch that only some tasks need into a sibling file linked from it, give a job with its own trigger its own skill, and never nest skills.
- After a change, check that links resolve and each rule has one owner, then give a fresh session a real task the change governs and watch whether it follows the rule.

## READMEs And Guides

These are read by a person using or extending ttsc.

- A README is for the package's user: what it is, when to use it, installation, the smallest working setup, and a link to its guide. Leave internals, protocols, and edge cases to the guide.
- A guide under `website/src/content/docs/` serves one reader (consumer, package user, bundler user, runtime user, plugin author, or maintainer) and one task, with the options, examples, and troubleshooting that task needs. Package folders hold package use, `development/` holds plugin authoring, and top-level pages hold cross-cutting tasks. Update the folder's `_meta.ts` when adding, renaming, or moving a guide.
- Take every code example from code that runs, and update the guide in the same change as the behavior it describes.

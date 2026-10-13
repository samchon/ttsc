---
name: documentation
description: Owns ttsc's writing rules and writes its READMEs and website guides. Use before writing or changing a README or anything under website/src/content, and with prompting before changing AGENTS.md or a skill.
---

# Documentation

Good writing is the same for every reader: deliver the core point concisely and clearly. Only the reader, and so what the reader needs, differs by document; agent prompts add the rules in the prompting skill.

## Writing

- Write only what the reader needs and would not otherwise know. Cut padding, repetition, preamble, filler, and closing summaries; completeness means covering what the reader needs, never longer phrasing.
- One point, one sentence, one place. Give the reason when it is not obvious.
- Say what to do rather than what to avoid; when a prohibition is needed, name the concrete pattern.
- Plain English with one term per concept, and no emphasis capitals, em-dashes, emoji in prose, promotional adjectives, stock AI phrasing, or hedging.

## Paragraphs And Lists

A paragraph is one topic. Start a new one when the topic changes and keep sentences on the same topic together; merging topics to save paragraphs and splitting every sentence are both failures. Write each paragraph on one source line.

Use a list for parallel items, for steps whose order changes the result, and for their sub-steps, marking a sublist differently from its parent, such as `-` items under a numbered list. Write an argument whose conditions, reasons, and exceptions depend on each other as prose. Use a table for repeated mappings and a code block for exact commands.

## READMEs And Guides

These are read by a person using or extending ttsc.

- A README is for the package's user: what it is, when to use it, installation, the smallest working setup, and a link to its guide. Leave internals, protocols, and edge cases to the guide.
- A guide under `website/src/content/docs/` serves one reader (consumer, package user, bundler user, runtime user, plugin author, or maintainer) and one task, with the options, examples, and troubleshooting that task needs. Package folders hold package use, `development/` holds plugin authoring, and top-level pages hold cross-cutting tasks. Update the folder's `_meta.ts` when adding, renaming, or moving a guide.
- Take every code example from code that runs.

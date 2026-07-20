---
name: documentation
description: Defines README, website-guide, and agent-instruction structure, concise prose, and voice for ttsc. Use before writing, modifying, renaming, or moving repository documentation.
---

# Documentation

## READMEs

README files are for the final reader of that package or directory. Start with what it is, when to use it, installation, the smallest working setup, and the common path.

Keep README language direct and practical. Avoid compiler theory, protocol details, internal architecture, and edge cases unless the reader must know them to use the package. Move deep explanations into the website guides and link them only as the next step.

## Guide Documents

Guide documents live under `website/src/content/docs/` as MDX, served by Nextra at https://ttsc.dev. They are the detailed layer. Each guide must name its reader: consumer, package user, bundler user, runtime user, plugin author, or maintainer.

Organize the tree by audience:

- top-level pages (`index.mdx`, `setup.mdx`, `faq.mdx`, `benchmark/`) for cross-cutting tasks;
- per-package folders (`ttsc/`, `lint/`, `plugins/`, `wasm/`) for package users; and
- `development/` for plugin authors and maintainers.

Package guides may cover full options, recipes, troubleshooting, compatibility, and migration. Plugin-author guides may cover protocols, Go APIs, testing, publishing, and internals.

Keep one audience and task per page. Update the matching `_meta.ts` whenever a guide is added, renamed, or moved.

## Agent Instructions

`AGENTS.md` and `SKILL.md` files are operational documents for humans and agents. Keep only the product-wide contract in `AGENTS.md`, the always-applicable procedure in `SKILL.md`, and conditional detail in a linked sibling document.

Concise and clear means:

- Include the context needed to act correctly. Do not make the reader infer prerequisites, exceptions, reasons, or stop conditions merely to shorten the document.
- State each rule at its owning document and link to it elsewhere. Remove repeated wording, not necessary substance.
- Give each paragraph one job. Separate purpose, rule, rationale, procedure, and consequence when combining them obscures the action.
- Use structure to compress meaning: ordered lists for procedures, bullets for choices and checks, tables for repeated mappings, and code blocks for exact commands.
- State the rule before its reason. Use a negative rule only when it prevents a named failure the affirmative rule does not already exclude.
- Link to website guides, READMEs, or source comments instead of paraphrasing them.

## Prose line breaks

Write each Markdown or MDX paragraph on one source line. Never hard-wrap a single paragraph at a fixed column: Markdown already soft-wraps it, while manual wrapping makes small edits reflow unrelated lines.

One source line does not mean one long paragraph. Insert a blank line whenever the idea changes. Keep structural line breaks for paragraphs, list items, headings, tables, and fenced code.

The repository enforces `prettier --prose-wrap never` across `*.md` and `*.mdx`. `embeddedLanguageFormatting: off` keeps fenced code byte-identical. Run the repository format script instead of wrapping prose by hand.

## Voice

Write in the plain, direct voice of the human-authored docs in this repo. Do not write like an AI assistant.

- No em-dashes. Use a period, comma, colon, or parentheses.
- No emoji.
- No AI-cliche phrasing: "not only X but also Y", "whether you're X or Y", "it's worth noting", "let's dive in", filler adjectives like "seamless", "powerful", "robust", "effortless", and reflexive hedging.
- No wrap-up sentence that just restates the paragraph. State the fact and stop.

---
name: documentation
description: READMEs and website guides. Read before writing or modifying docs.
---

# Documentation

## READMEs

README files are for the final reader of that package or directory. Start with what it is, when to use it, installation, the smallest working setup, and the common path.

Keep README language direct and practical. Avoid compiler theory, protocol details, internal architecture, and edge cases unless the reader must know them to use the package. Move deep explanations into the website guides and link them only as the next step.

## Guide Documents

Guide documents live under `website/src/content/docs/` as MDX, served by Nextra at https://ttsc.dev. They are the detailed layer. Each guide must name its reader: consumer, package user, bundler user, runtime user, plugin author, or maintainer.

The tree is organized by audience: top-level pages (`index.mdx`, `setup.mdx`, `faq.mdx`, `benchmark/`) for cross-cutting tasks, per-package folders (`ttsc/`, `lint/`, `plugins/`, `wasm/`) for package guides, and `development/` for plugin-author guides. Package guides may go deeper than README with full options, recipes, troubleshooting, compatibility notes, and migration details. Plugin-author guides may cover protocol, Go APIs, testing, publishing, and internals. Keep one audience and task per page, and update the matching `_meta.ts` when adding, renaming, or moving a guide.

## Prose line breaks

Write Markdown and MDX prose as one line per paragraph, never hard-wrap at a fixed column. Markdown soft-wraps on render, so a manual line break mid-paragraph changes nothing visible while making diffs noisy (a reworded sentence reflows several lines) and edits awkward. Keep real line breaks only for paragraph boundaries, list items, headings, tables, and fenced code. `prettier --prose-wrap never` (with `embeddedLanguageFormatting: off`, so code fences stay byte-identical) enforces this across `*.md` and `*.mdx`. Run the repo `format` script rather than wrapping by hand.

## Voice

Write in the plain, direct voice of the human-authored docs in this repo. Do not write like an AI assistant.

- No em-dashes. Use a period, comma, colon, or parentheses.
- No emoji.
- No AI-cliche phrasing: "not only X but also Y", "whether you're X or Y", "it's worth noting", "let's dive in", filler adjectives like "seamless", "powerful", "robust", "effortless", and reflexive hedging.
- No wrap-up sentence that just restates the paragraph. State the fact and stop.

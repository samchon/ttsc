# Prose And Voice

These rules apply to every Markdown and MDX document in the repository, including READMEs, website guides, `AGENTS.md`, and skills.

## Line Breaks

Write each Markdown or MDX paragraph on one source line. Never hard-wrap a single paragraph at a fixed column: Markdown already soft-wraps it, while manual wrapping makes small edits reflow unrelated lines.

One source line does not mean one long paragraph. Insert a blank line whenever the idea changes. Keep structural line breaks for paragraphs, list items, headings, tables, and fenced code.

The repository enforces `prettier --prose-wrap never` across `*.md` and `*.mdx`. `embeddedLanguageFormatting: off` keeps fenced code byte-identical. Run the repository format script instead of wrapping prose by hand.

## Voice

Write in the plain, direct voice of the human-authored docs in this repo. Do not write like an AI assistant.

- No em-dashes. Use a period, comma, colon, or parentheses.
- No emoji.
- No AI-cliche phrasing: "not only X but also Y", "whether you're X or Y", "This isn't about X. It's about Y.", a rhetorical question answered in the next sentence, "it's worth noting", "importantly", "let's dive in", "delve", "foster", "leverage", "genuinely", filler adjectives like "seamless", "powerful", "robust", "effortless", and reflexive hedging.
- No invented compound labels. State the relationship with plain verbs and prepositions instead of coining a term the reader has not seen.
- No wrap-up sentence that just restates the paragraph, such as "In short:" or "Bottom line:". State the fact and stop.

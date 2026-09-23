# Website And READMEs

Read this document through the documentation skill before writing, changing, renaming, or moving a README or a website guide. Prose and voice follow [prose.md](prose.md).

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

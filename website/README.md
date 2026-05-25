# `@ttsc/website`

The `ttsc.dev` site. Built with Next.js 15 (App Router, static export) + Nextra 4 + Tailwind v4.

## Three sections

- **Docs** — Guide documents for consumers, plugin authors, lint users, and editor users.
- **Tutorial** — A curated 6-step walkthrough from install to bundler integration.
- **Playground** — Monaco-based in-browser editor that runs the `typia` transformer and previews a subset of `@ttsc/lint` format rules.

## Commands

```bash
pnpm install
pnpm dev       # compiler worker rebuild + next dev
pnpm build     # static export into ./out
pnpm deploy    # publish ./out to gh-pages
```

## Layout

```
website/
├── src/
│   ├── app/                            # Next.js App Router routes
│   │   ├── layout.jsx                  # Nextra navbar/footer/sidebar shell
│   │   ├── global.css                  # Tailwind + Nextra theme + landing tweaks
│   │   ├── [[...mdxPath]]/             # Catch-all MDX pages (docs, tutorial, index)
│   │   └── playground/                 # Interactive playground route
│   ├── content/
│   │   ├── _meta.ts                    # Top-level navigation
│   │   ├── index.mdx                   # Landing page
│   │   ├── docs/                       # Guide documents (mirrors /docs in repo)
│   │   └── tutorial/                   # Sequential walkthrough
│   ├── components/
│   │   ├── home/                       # Landing page parts
│   │   └── playground/                 # Monaco editor + result/diagnostics panels
│   ├── compiler/                       # Worker boundary (tgrid)
│   │   ├── index.ts                    # Worker entry compiled by build/compiler.cjs
│   │   ├── ICompilerService.ts         # Service contract shared by main + worker
│   │   ├── ITransformOptions.ts
│   │   ├── COMPILER_OPTIONS.ts
│   │   └── PlaygroundExampleStorage.ts
│   └── movies/landing/                 # Landing page sections (hero, features, CLI, plugins, CTA)
├── public/
│   ├── favicon/                        # Favicon set + webmanifest
│   ├── compiler/                       # Output of build/compiler.cjs (worker bundle)
│   └── og.jpg                          # Copied from /assets/og.jpg
└── build/
    ├── compiler.cjs                    # Rspack-based worker bundler
    └── deploy.cjs                      # gh-pages deploy
```

## Playground compiler

The playground mirrors typia's worker-boundary architecture (tgrid `WorkerConnector` on the main thread, `WorkerServer` in the worker), so the compilation backend is replaceable. The first cut runs:

1. **typia** — via `@typia/transform` as a TypeScript transformer factory, fed by the in-browser `typescript` compiler API.
2. **lint** — a small subset of `@ttsc/lint` format rules (`format/quotes`, `format/semi`, `format/trailing-comma`, `no-var`, `eqeqeq`) reimplemented in TypeScript on top of the same AST. The full Go-backed lint engine is the next iteration target; the worker contract does not change when it lands.

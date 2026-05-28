# Agent 5 — lint documentation: knowledge base

## Files read

- `/home/samchon/github/samchon/ttsc/packages/lint/README.md` (1197 lines)
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/_meta.ts`
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/index.mdx`
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/setup.mdx`
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/format.mdx`
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/rules/_meta.ts`
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/rules/index.mdx`
- `/home/samchon/github/samchon/ttsc/website/src/content/docs/lint/rules/unicorn.mdx`
- (sampled) every other `website/src/content/docs/lint/rules/*.mdx` rule family page

Cross-checked against:

- `packages/lint/src/structures/rules/ITtscLint*Rules.ts` (authoritative interface)
- `packages/lint/linthost/rules_*.go` (146 unicorn + 287 total rule files)
- `tests/test-lint/src/cases/*.ts(x)` (fixture link targets)

## Findings — stale README claims (code doesn't match)

- `packages/lint/README.md:14` — claim: "580+ rules". Actual rule count from interfaces (`ITtscLint*Rules.ts`) is **725** (Core 149, TypeScript 98, React 29, ReactPerf 4, JsxA11y 37, Nextjs 21, Solid 21, Jest 19, Vitest 13, TestingLibrary 29, Playwright 31, Cypress 13, Storybook 16, TanstackQuery 8, Promise 17, Regexp 22, Security 13, Jsdoc 13, Functional 20, Boundaries 6, Unicorn 146). "580+" is technically still true but reads as stale by ~145 rules — most likely written before Unicorn (146) landed.
- `packages/lint/README.md:200-353` — Core ESLint section is missing one rule documented in `ITtscLintCoreRules.ts`: `no-shadow` (registered at `packages/lint/linthost/rules_no_shadow.go:Register(noShadow{})`). Bullets present in both README and `core.mdx` for every other core rule.
- `packages/lint/README.md:355-449` — TypeScript section is missing nine rules that exist in `ITtscLintTypeScriptRules.ts` and are registered in `linthost/`:
  - `typescript/no-unnecessary-qualifier` (`rules_ts_no_unnecessary_qualifier.go`)
  - `typescript/no-unsafe-argument` (`rules_ts_no_unsafe_argument.go`)
  - `typescript/no-unsafe-assignment` (`rules_ts_no_unsafe_assignment.go`)
  - `typescript/no-unsafe-call` (`rules_ts_no_unsafe_call.go`)
  - `typescript/no-unsafe-member-access` (`rules_ts_no_unsafe_member_access.go`)
  - `typescript/prefer-find` (`rules_ts_prefer_find.go`)
  - `typescript/prefer-regexp-exec` (`rules_ts_prefer_regexp_exec.go`)
  - `typescript/prefer-return-this-type` (`rules_ts_prefer_return_this_type.go`)
  - `typescript/sort-type-constituents` (`rules_ts_sort_type_constituents.go`)
  - All nine have fixtures at `tests/test-lint/src/cases/typescript-*.ts`, so the README's "create fixture before bullet" rule is satisfied — they're just not bulleted.
- `packages/lint/README.md:159` — claim: "the intersection of family-specific interfaces such as `ITtscLintCoreRules`, `ITtscLintTypeScriptRules`, `ITtscLintReactRules`, and `ITtscLintVitestRules`". Accurate but underspecified — 21 family interfaces ship (see `packages/lint/src/structures/rules/`); citing four of them risks reading as the full list. Minor.

## Findings — wrong examples

- `packages/lint/README.md:33-48` — the sample `ttsc` diagnostic output uses real codes (`TS17397` for `prefer-const`, `TS11966` for `no-var`). I recomputed the FNV-1a hash from `packages/lint/linthost/compile.go:432 RuleCode(...)` and both match. **No issue.** Listed for completeness.
- `packages/lint/README.md:33-48` — the demo shows `error TS2322` from `tsc` paired with `error TS17397`/`TS11966` from lint. README:80-87 then claims "Errors fail the command; warnings print without affecting the exit code." That matches the host implementation. **No issue.** Listed for completeness.
- `packages/lint/README.md:1043-1046` — the recommended Functional preset example uses `"functional/type-declaration-immutability": ["error", { rules: [{ identifiers: ".*" }] }]`. The options shape is plausible (matches `ITtscLintFunctionalRuleOptions.ts`) but I did not exhaustively validate every nested key against the upstream port — flag for Agent 4 to confirm. Minor.

## Findings — out-of-date rule lists / counts

- `website/src/content/docs/lint/rules/index.mdx:11-33` — the "Rule families and config types" table:
  - Core: documented `110`, actual interface count `149` (and MDX renders 147 bullets — itself missing 2 rules). Off by **39+**.
  - TypeScript: documented `54`, actual interface count `98` (MDX renders 89). Off by **44**.
  - React: documented `26`, actual interface count `29`. Off by **3**.
  - Solid: documented `20`, actual interface count `21`. Off by **1**.
  - Security: documented `14`, actual interface count `13`. Off by **1** (over-counted).
  - Architecture boundaries: documented `5`, actual interface count `6`. Off by **1**.
  - **Unicorn (146 rules) is entirely absent from the rule-families table** even though `rules/unicorn.mdx` ships, `_meta.ts` lists it, and `ITtscLintUnicornRules.ts` defines the interface.
- `website/src/content/docs/lint/index.mdx:26` — "580+ lint rules" claim and the parenthetical category list `(Core, TypeScript, React, JSX-A11y, Promise, Solid, Testing Library, Jest, Vitest, Playwright, Cypress, Storybook, Next.js, TanStack Query, Regexp, Security, JSDoc, Functional, Boundaries, react-perf)` — **omits Unicorn** entirely. Same stale figure as README:14.

## Findings — broken or stale website docs

- `website/src/content/docs/lint/rules/core.mdx` — missing bullets for `consistent-return` and `no-shadow` (both registered in `linthost/` with fixtures present). Confirmed via diff of `ITtscLintCoreRules.ts` keys (149) vs MDX bullets (147).
- `website/src/content/docs/lint/rules/typescript.mdx` — missing bullets for the same nine TypeScript rules listed above (interface 98 vs MDX 89). Same gap as README — both pages drifted together.
- `website/src/content/docs/lint/format.mdx:108-110` — the `format/print-width` description mentions defaults `80, 2, false, "lf"` for `printWidth, tabWidth, useTabs, endOfLine`. Did not validate against `packages/lint/linthost/config_format.go`; flag for Agent 4 if defaults have shifted. Minor.
- `website/src/content/docs/lint/index.mdx:40-41` — links "Plugin Development · Walkthroughs" → `/docs/development/walkthroughs`. The actual contributor walkthrough lives at `/docs/development/walkthroughs/lint` (file `website/src/content/docs/development/walkthroughs/lint.mdx`). The index page exists at `walkthroughs/index.mdx`, so the link is *not* broken, but a deeper, more direct link to `/docs/development/walkthroughs/lint` would match the section's intent.
- `website/src/content/docs/lint/index.mdx:21,44` — "If you only have five minutes" duplicates the H1 link to Setup. Stylistic, not stale, but flag for tightening.

## Findings — missing rule pages

No top-level rule-page MDX files are missing — every entry in `website/src/content/docs/lint/rules/_meta.ts` maps to an existing `.mdx`, and `_meta.ts` covers every `.mdx` in `rules/` exactly (verified by `diff` of file listing vs sorted key set).

The gaps are within-file: 11 individual rule bullets missing (2 core + 9 typescript), enumerated above.

## Findings — _meta.ts mismatches

None. Verified:

- `website/src/content/docs/lint/_meta.ts` keys (`index, setup, format, rules`) ↔ files `index.mdx, setup.mdx, format.mdx, rules/index.mdx`. Match.
- `website/src/content/docs/lint/rules/_meta.ts` keys (22 entries) ↔ `.mdx` files in `rules/` (22 files). Exact match.

Order of `_meta.ts` is alphabetical except for `index` first, which matches the rule-page table order in `rules/index.mdx`. Internally consistent.

## Findings — withdrawn inline-option leakage

No leakage. `packages/lint/README.md` and `website/src/content/docs/lint/**` consistently treat `lint.config.ts` as the canonical config home — no examples reintroduce inline `@ttsc/lint`, `@ttsc/banner`, `@ttsc/paths`, or `@ttsc/strip` option keys on the plugin descriptor.

Worth noting (not a violation, but a gap): neither README nor the lint guide mentions the `configFile` escape hatch from AGENTS.md §2.1 (the explicit-path opt-out from upward-walk discovery). If `@ttsc/lint`'s entry plugin accepts `configFile`, that surface deserves one line in `setup.mdx` next to the upward-walk paragraph at `setup.mdx:38`.

## Candidate proposals (to surface in discussion)

1. **Re-count and rewrite `rules/index.mdx:11-33` table.** Read the rule counts directly from `packages/lint/src/structures/rules/ITtscLint*Rules.ts` (or scrape `linthost/rules_*.go`) so the table is mechanically true. Add a Unicorn row. Replace handwritten integers with a comment pointing to a single source of truth.
2. **Add the 11 missing rule bullets.** Two core rules (`consistent-return`, `no-shadow`) into `README.md` § ESLint core and `rules/core.mdx`. Nine typescript rules (`typescript/no-unnecessary-qualifier`, `typescript/no-unsafe-argument`, `typescript/no-unsafe-assignment`, `typescript/no-unsafe-call`, `typescript/no-unsafe-member-access`, `typescript/prefer-find`, `typescript/prefer-regexp-exec`, `typescript/prefer-return-this-type`, `typescript/sort-type-constituents`) into the same two files. All fixtures exist already.
3. **Update the "580+ rules" claim to the real number** (725 today) in `README.md:14` and `index.mdx:26`, and add Unicorn to the inline category enumeration on `index.mdx:26`.
4. **Wire a CI check that diffs interface keys vs README/MDX bullets.** The exact gaps caught above (`no-shadow`, the 9 typescript rules) are mechanical drift between three places: interface, README, MDX. A single script reading `ITtscLint*Rules.ts` and asserting bullet coverage in README and MDX would prevent recurrence — and would already be passing for 19 of 21 families.
5. **Sort the React and Testing Library bullets canonically.** Minor: README orders `react/no-danger` slightly before `react/no-danger-with-children` while MDX puts them in the opposite order; same for `testing-library/prefer-user-event` / `prefer-user-event-setup`. Pick the alphabetical sort the README's AGENT INSTRUCTIONS already mandate.
6. **Mention `configFile` once in `setup.mdx`.** AGENTS.md §2.1 names it as the only host-owned key beyond auto-discovery. Even a one-line "Pass `configFile: 'path/to/lint.config.ts'` to the plugin descriptor when auto-discovery isn't appropriate" would close the gap.
7. **Consider trimming `README.md` rule lists in favor of links to per-family MDX pages.** AGENTS.md §3.1 says READMEs should be direct and practical, with deep detail moving to the website. At 1197 lines, the README is mostly a flat rule-by-rule catalog (lines 199–1112) — the same content the per-family MDX pages serve more navigably. Reducing the README's Rules section to one short paragraph per family plus a link would cut ~900 lines and make drift cheaper to catch.

# Agent 3 — lint src/ TypeScript: knowledge base

## Scope reality check

The prompt's scope listed subdirs `command/`, `config/`, `engine/`, `fix/`,
`format/`, `plugin/`, `printer/`, `registry/`, `rules/`, `shared/`. None of
those exist under `packages/lint/src/`. The actual TS surface is:

```
packages/lint/src/
  index.ts                              927 lines
  defaultFormat.ts                       33 lines
  structures/
    ITtscLintConfig.ts
    ITtscLintFormat.ts
    ITtscLintPlugin.ts
    ITtscLintPluginConfig.ts
    ITtscLintPluginMeta.ts
    TtscLintRuleSetting.ts
    TtscLintSeverity.ts
    index.ts
    rules/                              31 family interfaces + index
```

All CLI/engine/fix/format/printer logic actually lives in
`packages/lint/linthost/**` (Go). The TS package is the published
**descriptor factory + types** consumed by ttsc's plugin host. Findings
below cover what's actually in `src/`.

## Files read in full

- `src/index.ts` — descriptor factory, lint config discovery (json/cjs/ttsx),
  on-disk content-addressed plugin cache, contributor validation.
- `src/defaultFormat.ts` — frozen Prettier-aligned defaults const.
- `src/structures/index.ts` — re-export aggregator.
- `src/structures/ITtscLintConfig.ts` — top-level user config shape.
- `src/structures/ITtscLintFormat.ts` — `format` block shape.
- `src/structures/ITtscLintPlugin.ts` — contributor descriptor shape.
- `src/structures/ITtscLintPluginConfig.ts` — tsconfig plugin entry shape.
- `src/structures/ITtscLintPluginMeta.ts` — `meta` block.
- `src/structures/TtscLintRuleSetting.ts` — severity + tuple unions.
- `src/structures/TtscLintSeverity.ts` — severity literal union.
- `src/structures/rules/index.ts` — re-export aggregator.
- `src/structures/rules/ITtscLintRules.ts` — intersection of all families.
- `src/structures/rules/ITtscLintRuleOptionsMap.ts` — augmentable rule→options map.
- `src/structures/rules/ITtscLintContributorRules.ts` — `${ns}/${rule}` catch-all.
- `src/structures/rules/ITtscLintCoreRules.ts` (sampled in full).
- `src/structures/rules/ITtscLintBoundariesRules.ts`.
- `src/structures/rules/ITtscLintReactPerfRules.ts`.

## Architecture as I understand it

1. ttsc host invokes the default export of `@ttsc/lint` with a factory
   context (binary path, cwd, tsconfig path, plugin entry object).
2. `createTtscPlugin` validates the tsconfig plugin entry rejects every key
   except `enabled`, `name`, `stage`, `transform`, `configFile`.
3. It resolves the lint config file path: explicit `configFile` OR upward
   walk from tsconfig dir for `lint.config.{ts,cts,mts,js,cjs,mjs,json}` /
   `ttsc-lint.config.*`.
4. It dispatches by extension:
   - `.json` → `JSON.parse`, strings interpreted as npm specifiers,
     resolved via `createRequire(configPath)`.
   - `.js` / `.cjs` → `require()`, string/object values both accepted.
   - `.ts` / `.cts` / `.mts` / `.mjs` → spawn `ttsx` with a generated
     `.mts` loader + scratch tsconfig in a `mkdtempSync` directory; the
     loader walks `default` indirections, calls a top-level factory, and
     emits `{entries: [{namespace, source}]}` on stdout.
5. The `.ts`-path result is cached on disk under `os.tmpdir()
   /ttsc-lint-config-cache/<sha256>.json`, keyed by the config file's
   absolute path + exact byte content + `CONFIG_CACHE_VERSION="v1"`.
6. Each contributor namespace becomes a Go subpackage name (hyphens →
   underscores) and is forwarded to ttsc's plugin builder as a
   `{name, source}` contributor entry.

## Findings — bugs

- `**src/index.ts:10**` — `export * from "./defaultFormat";` and
  `export * from "./structures/index";` happen on a module that **also has a
  default export `createTtscPlugin`**. Both default and star-exports work,
  but downstream `import lint from "@ttsc/lint"` is the host's only doc'd
  entry yet is marked `@internal` (line 109). The annotation is
  load-bearing for VS Code completion; it currently dims the only
  documented host hook. Either drop `@internal` or document the host
  contract elsewhere.

- `**src/index.ts:225**` — `if (FRAMEWORK_KEYS.has(key) || key === "configFile") continue;`
  treats arbitrary host-future keys as a hard error. If ttsc ships a new
  host-level key (`logger`, `cache`, …) every existing `@ttsc/lint` install
  will throw until released. Most other ttsc plugins accept-and-ignore
  unknown keys for forward-compat; this throws by design but the message
  doesn't say "if this is a ttsc framework key, upgrade @ttsc/lint".

- `**src/index.ts:262-279** (`findLintConfigFile`)** — when **multiple**
  candidate filenames coexist in one directory, the function silently
  returns `undefined` and defers to the Go side. The doc comment
  acknowledges this but the silent path means a typo (`lint.config.js` +
  `lint.config.mjs` side by side) will look like "no lint config" until
  the user runs the Go binary that surfaces the duplicate-detection error.
  Surface it here too — same package owning both sides.

- `**src/index.ts:340-352** (JSON path) vs `**src/index.ts:790-812** (CJS
  path)** — both accept a string specifier and resolve via
  `createRequire(configPath)`, but the JSON branch routes through
  `loadContributorPluginViaRequire` (friendly error wrappers around BOTH
  resolve and require) whereas the CJS branch's `normalizePluginValue`
  has its own resolve wrap but a **bare** `requireFromConfig(resolved)`
  call (no try/catch). A loading failure in a CJS-config-loaded plugin
  emits a raw Node module error instead of the wrapped
  `@ttsc/lint: failed to load contributor "…"` message.

- `**src/index.ts:399-401** (TTSX_EXTRACTOR_SCRIPT inner loader)** —
  `if (typeof current === "function") { current = await (current as () => ...)(); }`
  runs the factory **once**. A user who writes `defineConfig(() => () =>
  config)` (rare but legal) gets a function back, not a config. The outer
  `unwrapDefault` allows up to 8 hops; the factory invocation is
  asymmetric.

- `**src/index.ts:411**` — `process.stdout.write(JSON.stringify({entries}))`
  emits raw JSON on stdout with **no sentinel**. If ttsx (or `--no-plugins`
  doesn't suppress everything) ever writes a banner or warning to stdout,
  the parent `JSON.parse(result.stdout)` on line 613 will throw an opaque
  "invalid JSON" error. Sentinel like `"<<<TTSC_LINT_RESULT>>>"` would
  make this robust.

- `**src/index.ts:451** vs `**src/index.ts:849** — `extractPluginSource`
  walks **4** default-hops, `unwrapDefault` walks **8**. They sit
  side-by-side and serve the same purpose (CJS/ESM interop unwrap), so the
  asymmetry will silently misroute one path on the same input. Pick one.

- `**src/index.ts:452-456** (extractPluginSource)** — terminates the
  unwrap loop the moment `typeof current.source === "string"` is true, but
  before that does **not** check `typeof current.source` before peeking
  `current.default`. If a user wraps `{source: ...}` inside `{default: {source: ...}}`
  the inner one wins, which is correct. But if `current.source` is a
  truthy non-string the loop accepts it as final and the validation later
  (lines 632-636) rejects with a misleading message that says the plugin
  "did not expose a 'source' string" — even though the loop happily kept
  the non-string value. Fix by tightening the break to `&& typeof current.source === "string"`
  alone (drop the second early-bail).

- `**src/index.ts:483**` — `if (cached && cached.every(isValidConfigPluginEntry))
  return cached;` only validates *entry* shape. The `cached` array shape
  is unverified — a corrupted cache file containing `[{}]` (where `{}`
  fails `isValidConfigPluginEntry` cleanly) re-evaluates, but a corrupted
  array of length 0 (`[]`) **passes**, masking an actual loss of plugins.
  Add a sentinel that records `evaluatedAt` and treats an empty array as
  "unknown" unless the loader explicitly wrote one.

- `**src/index.ts:565**` — `process.env.TTSC_TTSX_BINARY ?? "ttsx"`
  resolves through `PATH` only when the env var is unset. In a monorepo
  install the project's own `node_modules/.bin/ttsx` should be preferred
  over a global one; the current code requires the caller (ttsc itself)
  to set the env var. Walking up from `configPath` to find
  `node_modules/.bin/ttsx` would be more reliable.

- `**src/index.ts:600-605**` — when `result.signal` is set, the error
  blames the 60s timeout. It can equally be SIGTERM/SIGKILL from a
  parent's shutdown. The message should report the actual signal name
  before guessing the timeout.

- `**src/index.ts:884**` — `fs.symlinkSync(nodeModules, link, "junction")`
  swallows `EEXIST` but throws on anything else (e.g., `EPERM` on
  Windows without dev mode) wrapped with `@ttsc/lint:` text. The
  `linkNearestNodeModules` helper offers no fallback; on a Windows host
  without symlink privilege, ttsx evaluation simply cannot proceed.
  Consider `fs.cpSync(..., { recursive: true })` fallback, or skip the
  link and rely on `NODE_PATH` alone (which is already set).

- `**src/defaultFormat.ts:10-13` (JSDoc)** — example code uses `Import` /
  `Export` with capital initials. Reads as broken syntax; some auto-format
  pass mistook prose. The original was clearly meant to be a code-fence.

## Findings — perf / algorithmic

- `**src/index.ts:264-269** (`findLintConfigFile`)** — for every directory
  in the upward walk this does **14** `existsSync + statSync` pairs (one
  per filename in `LINT_CONFIG_FILENAMES`). Both calls do the same stat
  syscall, so it's effectively 28 syscalls per directory level. A
  `readdirSync(dir)` once and an intersection with the candidate set is
  one syscall per level. In deep monorepos with `tsconfig` 6+ levels under
  the workspace root this multiplies.

- `**src/index.ts:267-268**` — generic `existsSync(p) && statSync(p)
  .isFile()` pattern. `existsSync` is itself a stat. Use one `statSync`
  with a try/catch and check `isFile()`; eliminates one syscall per check
  (~50% of the FS calls in the discovery loop).

- `**src/index.ts:476-487** (`readTtsxConfigPlugins`)** — the cache write
  is fire-and-forget per process. Two sibling `ttsc` builds racing on
  the same config will both spawn `ttsx`, both write to the cache, and
  the rename in `writeConfigPluginCache` is atomic, so the result is
  fine — but the cost of duplicated `ttsx` spawns is real. No in-process
  promise dedupe (the function is sync, so it can't be promise-based,
  but a `Map<cacheKey, ConfigPluginEntry[]>` memo for the lifetime of
  this process would catch the common monorepo case where one ttsc run
  type-checks N packages that share a config). Today it re-reads cache
  for every project.

- `**src/index.ts:622-651**` — the `.map(entry => …)` does
  `existsSync + statSync` on `entry.source` per cache hit. The cache key
  already incorporates the config bytes, but contributors could have
  moved on disk independently. The re-validation is correct (see also
  line 510 in `isValidConfigPluginEntry`) but the cost on the cached-hit
  path could be amortized with a TTL or content hash of the contributor
  dir's package.json.

- `**src/index.ts:520-530**` — every `.ts`/`.mts` config eval allocates a
  fresh `mkdtempSync` + writes 2 files + symlinks `node_modules`. The
  cache miss path is fixed-cost (one ttsx subprocess), but the wrapper
  could reuse a per-monorepo cached scratch dir keyed by config-dir, so
  successive misses for different configs in the same workspace skip
  the symlink-creation tax.

## Findings — type safety

- `**src/index.ts:224** — `Object.keys(entry as Record<string, unknown>)`
  on `ITtscLintPluginConfig`. The cast is fine; the design choice
  enforces unknown-key rejection.
- `**src/index.ts:245** — `(context.plugin as { configFile?: unknown })
  .configFile` widens to `unknown` before type-narrowing on line 247-249.
  Fine.
- `**src/index.ts:613** — `JSON.parse(result.stdout) as { entries?: ...}`
  trusts the loader's shape contract. Defensively the function does
  validate each `entry` afterwards (lines 627-649), so the cast is OK
  but a discriminated `result.kind === "ok"` sentinel would let
  ttsx-vs-loader stdout collisions be distinguished from valid empty
  output.
- `**src/index.ts:725** — `return Array.isArray(parsed) ? (parsed as
  ConfigPluginEntry[]) : undefined;` — same: cast trusts cache content
  but `readTtsxConfigPlugins` does the actual element-shape validation
  before forwarding (line 483).
- `**src/index.ts:844** — `return obj as unknown as ITtscLintPlugin;`
  double-cast through `unknown`. The validator only checks `source`
  string + `path.isAbsolute` + directory existence; nothing on `meta`
  or `rules`. A contributor returning `{source, rules: 42}` slips past
  this validator. The `unknown` double-cast is a flag that the validation
  is structural-but-shallow.
- `**src/structures/rules/ITtscLintBoundariesRules.ts:94** vs
  `**src/structures/rules/ITtscLintRuleOptionsMap.ts**` — the
  `"boundaries/dependencies"` rule key is declared in the rule family
  interface but missing from `ITtscLintRuleOptionsMap`. Cross-package
  augmentation patterns (`declare module "@ttsc/lint" { interface
  ITtscLintRuleOptionsMap { ... } }`) work for downstream consumers, but
  built-in rules are expected to appear in the map. Inconsistent.
- `**src/structures/ITtscLintConfig.ts:23** — `extends?: string;` is a
  single string, but ESLint flat-config and most other lint tools accept
  `string | string[]`. Not a bug yet (Go side reads the same shape) but a
  forward-compat hazard if the chain feature lands.
- `**src/structures/rules/ITtscLintContributorRules.ts:17** — the
  template-literal-typed index signature `[ruleName:
  \`${string}/${string}\`]` collides at intersection time with the
  literal-keyed family interfaces. TS tolerates this because the literal
  property type is assignable to the index signature value type; but
  consumer error messages on a typo'd built-in key sometimes degrade to
  the contributor-rule union instead of the strict family setting. Not
  fixable without rewriting the union shape, but worth noting.

## Findings — dead code or stale TODOs

- `**src/index.ts:518** — `_context` parameter is prefixed with `_` but
  the function signature still requires it. The only reason it exists is
  to keep symmetry with `readTtsxConfigPlugins(configPath, context)`.
  Either drop the param or use it (e.g., to look up an explicit ttsx
  binary path from the host context).
- `**src/index.ts:382-388** (TTSX_EXTRACTOR_SCRIPT `declare const process`)
  — declares only the four fields the script touches. Fine, but `argv`
  is declared and never read. Trim.
- No `// TODO` / `// FIXME` markers found in `src/`.
- The example `"demo/no-marker-comment"` in
  `**ITtscLintRuleOptionsMap.ts:41**` is a fake rule name used only in the
  JSDoc. No-op — but a real downstream test contributor (`tests/lint-
  contributor-demo`) augments exactly this name; the comment doubles as
  spec, so keep but note the coupling.

## Findings — public surface accidents

- `**src/index.ts:111**` — `export default function createTtscPlugin(...)`
  is marked `@internal` but it IS the public host-contract surface. JSDoc
  `@internal` will hide it from typedoc.
- `**src/index.ts:10-11**` — `export * from "./defaultFormat"` and
  `export * from "./structures/index"` both leak EVERY type. That is
  intentional today (the public API is "everything in `structures/`"),
  but every new file in `structures/` becomes public the moment it's
  added. There is no `index.ts` barrel curated whitelist. A new
  internal-only type added to `structures/` would silently ship.
- `**src/index.ts**` contains many internal helpers (`goSubpackageName`,
  `readJsonConfigPlugins`, `evaluateTtsxConfigPlugins`, `configCacheKey`,
  `unwrapDefault`, `findNearestNodeModules`, `linkNearestNodeModules`,
  `relativeImportSpecifier`, `nodeConfigLoaderEnv`,
  `ttsxThroughNodeIfNeeded`) — none are exported, all are correctly
  module-private. ✓
- `**src/structures/rules/ITtscLintRuleOptionsMap.ts** export is a barrel
  surface for module augmentation. The pattern is conventional.

## Findings — comments that lie

- `**src/index.ts:33-43**` — `TtscPluginFactoryContext` JSDoc says the
  generic "is the tsconfig plugin entry shape". For `@ttsc/lint`,
  `ITtscLintPluginConfig` is the entry shape; the host actually passes
  the full raw object including unknown keys (hence the
  `rejectUnsupportedEntryKeys` check). The doc reads as if the host
  validates first; in practice this is what the lint factory itself does.

- `**src/index.ts:107**` — "The factory locates the config file, evaluates
  it (via ttsx for TS / ESM sources, `require` for CommonJS, `JSON.parse`
  for JSON), reads its `plugins` map" — the `plugins` map is read from
  the top-level config OR from inside any array element of an array-form
  flat config; the doc says "its `plugins` map" implying a single one.
  `collectPluginObjectsFromConfig` and the inline `collectPluginObjects`
  both gather **every** `plugins` map across array elements. Worth a
  one-line clarification.

- `**src/index.ts:118**` — "the same surface as before this feature
  shipped" — references a historical state that won't be obvious to a
  future reader. Anchor the comment to a behavior, not to a feature
  arrival.

- `**src/defaultFormat.ts:18-21**` — "the defaults const only seeds the
  rules that turn on unconditionally with a non-empty `format` block"
  reads like it documents runtime behavior, but `defaultFormat` is a
  passive constant: the Go-side activates the rules. The comment makes
  it sound like the constant itself drives activation.

## Candidate proposals (to surface in discussion)

1. **Unify `unwrapDefault` and `extractPluginSource`** — same purpose,
   different hop counts and prop-detection mechanics. Factor into one
   helper used by all 3 sites (JSON, CJS, ttsx-script inline).
2. **`findLintConfigFile` to one `readdirSync` per level** — replace the
   14 stat-pairs with a single dir listing plus set intersection.
   Eliminates ~28 syscalls per directory traversed.
3. **`existsSync + statSync` collapse** — wherever both run on the same
   path, replace with a try/`statSync`/catch ENOENT. The pattern occurs at
   lines 199-268, 510, 643-644, 870.
4. **Sentinel-wrap ttsx loader stdout** — emit `"<<<TTSC_LINT_BEGIN>>>"
   `…JSON…` `<<<TTSC_LINT_END>>>"` and slice in the parent; insulates
   against any ttsx-side stdout noise.
5. **Tighten `extractPluginSource` and `unwrapDefault` to consider the
   shape they're looking for** — current asymmetry can accept a non-string
   `current.source` and then emit a confusing "did not expose source
   string" error from a downstream validator.
6. **Add a per-process memo on top of the on-disk cache** — same monorepo
   ttsc run hitting one shared lint config repeatedly. Today it
   re-reads the JSON cache N times; trivially cacheable in-memory.
7. **Sync surface drift between `ITtscLintBoundariesRules` and
   `ITtscLintRuleOptionsMap`** — add `"boundaries/dependencies"` to the
   map, or document why one rule is intentionally off it.
8. **Drop `@internal` from the default export of `index.ts`**, or move
   the doc-facing entry comment to a non-`@internal` symbol.
9. **`Boolean(process.env.X)` cache disable** — switch to
   `process.env.X !== undefined && process.env.X !== "" && process.env.X !== "false"`
   to match users' intuition (`X=false` should not disable). Today it
   matches the Go side exactly, so changing this requires aligning both.
10. **Friendly-wrap the bare `require()` call in `normalizePluginValue`
    (line 805)** for parity with `loadContributorPluginViaRequire`.
11. **`evaluateTtsxConfigPlugins` should report the actual signal name**
    (`result.signal`) in the error before speculating about timeout.
12. **Curated barrel** — replace `export * from "./structures/index"`
    with an explicit list in `src/index.ts`, or guard against new files
    in `structures/` accidentally leaking.
13. **Fix the `defaultFormat.ts` JSDoc example** — restore
    `import` / `export` lowercase, wrap as a code fence.
14. **Trim unused `argv` from the inline `declare const process`** in
    `TTSX_EXTRACTOR_SCRIPT`.
15. **Drop the unused `_context` parameter of `evaluateTtsxConfigPlugins`,
    OR thread the context through so the host can override the ttsx
    binary path without relying on a global env var.

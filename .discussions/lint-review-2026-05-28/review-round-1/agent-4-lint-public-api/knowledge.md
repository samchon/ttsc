# Agent 4 — lint public Go API: knowledge base

## Files read in full

- `/home/samchon/github/samchon/ttsc/packages/lint/rule/rule.go` (292 lines)
- `/home/samchon/github/samchon/ttsc/packages/lint/rule/astutil/astutil.go` (161 lines)
- `/home/samchon/github/samchon/ttsc/packages/lint/plugin/main.go` (35 lines)
- `/home/samchon/github/samchon/ttsc/packages/lint/go.mod` (39 lines)
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/lsp.go` (733 lines)

## Files cross-referenced (partial reads)

- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/dispatch.go` — exact verbs accepted by `Main`
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/engine.go` — internal `Severity`, `Rule`, `Context`, `Finding`, `Register`, `runRuleCheck`, `byKind` build
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/contrib_adapter.go` — bridge from public `rule.Rule` to internal `Rule`
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/config.go` — internal `Severity` const ordering, `linkNearestNodeModules`, `RuleResolver`
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/fix.go` — `applyFindingFixes`, `applyTextEditsToFile`
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/format.go` — `filterFormatFindings`, `formatCommandResolver`, `maxFormatPasses`
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/compile.go` — `loadRules`, `resolveCwd`
- `/home/samchon/github/samchon/ttsc/packages/lint/linthost/host.go` — `loadProgram`, `canonicalProjectPath`
- `/home/samchon/github/samchon/ttsc/packages/lint/package.json` — confirms `go.sum` is NOT shipped
- `/home/samchon/github/samchon/ttsc/packages/ttsc/go.mod` — comparison: ttsc has `replace` directives; lint does not
- `/home/samchon/github/samchon/ttsc/scripts/test-go-lint.cjs` — scratch `go.work` overlay used by tests

## Public contract as documented

`rule.go` exposes the following to third-party rule packages ("contributors"):

- `rule.Severity` (int, `iota`: Off=0, Warn=1, Error=2) — mirrors the engine's internal `Severity`.
- `rule.Rule` interface — `Name() string`, `Visits() []shimast.Kind`, `Check(ctx *Context, node *shimast.Node)`.
- `rule.FormatRule` interface — embeds `Rule`, adds `IsFormat() bool` (structural marker, must return true).
- `rule.Reporter` interface — `Report(*shimast.Node, string)`, `ReportRange(int, int, string)`. Host-supplied callback.
- `rule.FixReporter` interface — `ReportFix(...)`, `ReportRangeFix(...)`. Host-side extension; documented as optional.
- `rule.TextEdit` struct — `Pos`, `End`, `Text`. Application policy documented: overlapping edits silently dropped.
- `rule.Context` struct — exported fields: `File`, `Checker`, `Severity`, `Options` (`json.RawMessage`). Private: `reporter`. Methods: `DecodeOptions`, `Report`, `ReportFix`, `ReportRange`, `ReportRangeFix`.
- `rule.NewContext(...) *Context` — labeled "Reserved for host code".
- `rule.Register(Rule)` — global registry mutator, called from contributor `init()`. Panics on `nil`. No duplicate-name check by design (host warns).
- `rule.Registered() []Rule` — returns defensive copy, called by host once at bootstrap.

`astutil` exposes:

- `NodeText(file, node) string` — node text with leading trivia stripped (and undocumented trailing-whitespace trim).
- `KeywordStart(file, node, keyword) int` — first-byte offset of a declaration keyword, or -1.
- `FindKeyword(file, pos, end, keyword) int` — keyword scan over an arbitrary byte range, identifier-aware.
- `TokenRange(file, node) (int, int)` — `(pos, end)` with trivia-stripped start.

Plugin entrypoint `plugin/main.go` is a 9-line wrapper that calls `linthost.Main(os.Args[1:])` and propagates the int return through `os.Exit`.

LSP surface in `linthost/lsp.go` exposes five entry functions called by `linthost.Main`:

- `RunLSPCommandIDs([]string) int` — prints `["ttsc.lint.fixAll", "ttsc.format.document"]`.
- `RunLSPCodeActionKinds([]string) int` — prints `["source.fixAll.ttsc", "source.format"]`.
- `RunLSPDiagnostics(args) int` — `--uri --cwd --tsconfig --plugins-json --range-json --context-json` → LSP diagnostic JSON.
- `RunLSPCodeActions(args) int` — same args → array of `lspCodeAction`.
- `RunLSPExecuteCommand(args) int` — `--command --arguments-json` (URI extracted from arguments[0]) → `lspWorkspaceEdit` JSON.

## Findings — broken/fragile astutil

1. **`NodeText` doc–impl mismatch (astutil.go:30-41).** The doc comment promises leading-trivia stripping but the body also calls `strings.TrimRight(src[pos:end], " \t\r\n")`. Trailing-whitespace trimming is undocumented and can silently swallow positions a rule expects to splice into a `TextEdit{End:}`. Either drop the `TrimRight` or amend the doc.

2. **`KeywordStart` 32-byte scan cap is opaque (astutil.go:71-83).** The 32-byte cap is documented as protection against malformed nodes, but a TypeScript declaration can legally carry many decorators or modifiers — `@a @b @c @d export async function …` exceeds 32 bytes before reaching `function`. The fallback scan silently returns -1, leaving the rule with no idea why the keyword "wasn't found". A more useful contract would scan until the first newline or `node.End()`, capped at e.g. 256 bytes, with a doc-comment explaining why.

3. **`KeywordStart` boundary check is ASCII-only (astutil.go:154-160).** `isIdentifierPart` rejects every non-ASCII byte. Source files using non-ASCII identifiers adjacent to a keyword (uncommon but legal in JS/TS) can mismatch. The comment acknowledges this; the risk is that an autofix uses `KeywordStart` to anchor a `TextEdit{Pos: start, End: start + len(keyword)}` and ends up cutting into a Unicode identifier character. Minor.

4. **`FindKeyword` does not skip strings/comments (astutil.go:94-123).** It walks raw bytes inside `[pos, end)`. If a rule passes a range that contains a string literal `"import"` or a `// import` comment, the helper returns a false hit. There is no documentation warning that the helper is purely lexical. For an autofix that splices `import { … } from "x"`, this is a footgun.

5. **`TokenRange` has no protection against `node.Pos() > node.End()` (astutil.go:132-143).** The check `end < pos || end > len(src)` accepts the case where post-`SkipTrivia` `pos` jumps past `end` (e.g., a node whose only content is leading trivia). The check `pos >= end` is missing, so a caller can get `(pos, end)` with `pos == end`, then attempt `src[pos:end]` (empty) and a `TextEdit` with a zero-width range — silently a no-op fix. Add the `pos >= end` guard to match `NodeText`.

## Findings — public surface accidents

1. **`Context.Checker *shimchecker.Checker` is mutable (rule.go:162).** The shim type has methods that mutate checker state. Contributors are trusted not to call them, but nothing in the type signature signals "read-only". The package doc explicitly defers the issue ("no facade layer in between"). At minimum the field comment should warn contributors not to call mutating Checker methods.

2. **`NewContext` is exported but documented "reserved for host code" (rule.go:179-196).** It is in the public API surface, so contributor unit tests legitimately call it (see `test/plugin/public_rule_context_report_fix_forwards_to_fixreporter_test.go:23`). The "reserved" wording in the comment is wishful — the function is part of the contract because tests rely on it. Doc should say "intended for host code AND contributor unit tests".

3. **`FixReporter` claims contributors do NOT implement it (rule.go:117-127), but the docs immediately tell them how to fake-satisfy it.** The wording is contradictory: "Contributor rules do NOT implement this interface" vs "A contributor authoring a fake reporter for unit tests can declare …". This is the same person — a contributor — playing both roles. Rewrite the doc as: "Rule production code calls `ctx.ReportFix` / `ctx.ReportRangeFix`. Test code that mocks the reporter must implement both Reporter and FixReporter together — Go interface satisfaction is all-or-nothing."

4. **Severity constants in `rule.go` and `linthost/config.go` are not link-asserted (rule.go:55-63, config.go:32-36).** Both define `Off=0, Warn=1, Error=2` via `iota`, and `contributorAdapter.Check` (contrib_adapter.go:98) does an unchecked cast `rule.Severity(ctx.Severity)`. If anyone reorders either set, the cast silently misroutes severity. There is no compile-time assertion or test pinning the equality (verified: only `rule.SeverityOff` appears in tests, no `_ = rule.SeverityX == linthost.SeverityX` constant-link check). Add a constant-link test in `test/plugin/` or a compile-time `const _ = uint(rule.SeverityError - Severity(SeverityError))` style assertion in `contrib_adapter.go`.

5. **`Reporter` is exported but never expected to be implemented outside the host (rule.go:103-110).** The only legitimate user of `Reporter` is the host's `contextReporter` (contrib_adapter.go:108) plus rule unit tests. Marking it as a public interface invites users to think implementing `Reporter` is part of "writing a rule" — which it is not, because `Context.Report` already proxies through the engine-supplied reporter. The doc could say so more explicitly.

6. **Variadic `edits ...TextEdit` in public methods (rule.go:226, 255).** A `nil` slice and zero-length slice both hit the "no edits" branch. Internal `cloneTextEdits` (engine.go:204-211) handles both, so this is fine. No bug, just worth noting that the `edits ...TextEdit` ergonomics force callers to spread `edits...` from an existing slice — typical Go idiom.

## Findings — plugin entry issues

1. **`plugin/main.go:1-16` lists only six subcommands.** The actual dispatcher in `linthost/dispatch.go:45` accepts **eleven** verbs: the six listed plus `lsp-command-ids`, `lsp-code-action-kinds`, `lsp-diagnostics`, `lsp-code-actions`, `lsp-execute-command`. The package doc comment is stale and would mislead a contributor reading the binary's godoc.

2. **No `recover()` around `linthost.Main` (plugin/main.go:33-35).** A panic from `registerContributors` (e.g., a buggy contributor `init` calling `linthost.Register` twice) would abort the binary with a Go stack trace, bypassing the engine's normal exit-code contract. The engine has `recover()` per-rule (engine.go:574-) but not at startup. A wrapper `recover()` in `main.go` that prints to stderr and `os.Exit(2)` would be safer for end users.

3. **Banner comment claims "in-process consumers (the ttsc.dev playground wasm) share the same dispatch surface" (plugin/main.go:23-24).** Verify this is still true: the playground may have its own dispatcher; if it does, this comment is inaccurate. Worth a one-line cross-check during the round.

## Findings — LSP wiring issues

1. **`rangeJSON` is parsed but never used (lsp.go:72, 192, 210).** The struct field, the `--range-json` flag, and the assignment all exist, yet no code path reads `opts.rangeJSON`. Either implement range-aware code actions (currently `RunLSPCodeActions` runs lint on the entire file regardless of cursor range) or remove the dead flag. As-is, callers may believe they are scoping code actions to a selection when they are not.

2. **`firstURIArgument` returns the wrong error for empty input (lsp.go:644-657).** When `--arguments-json` is the empty string, `json.Unmarshal([]byte(""), &args)` returns `"unexpected end of JSON input"` and the caller sees "invalid arguments JSON". The more useful "missing URI argument" path is unreachable for this common error. Special-case `strings.TrimSpace(raw) == ""` first.

3. **Stale on-disk reads in `lspWorkspaceEditForCommand` (lsp.go:347, 411).** The function reads the **on-disk** copy of the target via `os.ReadFile(target)` (line 347) for the "original" snapshot. If the editor has unsaved changes (the usual LSP state), `original` does not match the editor's buffer, and the returned `WorkspaceEdit` overwrites the editor's unsaved work with the contents the lint engine cascaded from the saved copy. The same applies to `lspFindings` (line 247), which only ever reads from disk. There is no `textDocument/didChange` integration. This is the LSP race condition called out in the audit scope.

4. **`lspWorkspaceEditForCommand` copies the entire workspace per request (lsp.go:432-458).** `copyLSPCommandWorkspace` walks the project tree, copying every regular file into a temp directory. For a 10k-file repository, this is an O(repo) operation per code-action execution. The walk does skip `node_modules`, `.git`, `.hg`, `.svn`, but not common large directories like `dist`, `build`, `.next`, `out`, `coverage`. For typical projects this is the dominant LSP latency cost.

5. **`workspaceEditForFullDocument` overwrites the whole file (lsp.go:419-430).** The returned edit has `Start={0,0}` and `End` at `len(original)` and replaces the entire document body. Editors lose cursor/scroll/undo granularity. A smarter diff (e.g., `myers` or `dmp`) would let the editor preserve cursor position. Not a bug, but a UX regression versus what e.g. `prettier`/`eslint --fix` integrations offer through their LSP equivalents.

6. **`acceptsActionKind` accepts when context is empty (lsp.go:321-332).** When `--context-json` is empty or unparseable, the function returns `true` (no `only` filter present → emit everything). This is the LSP-spec-correct behavior, but the helper silently swallows JSON-parse errors — there's no log line. Misformatted client requests would be invisible.

7. **`filePathFromURI` Windows handling is fragile (lsp.go:659-682).** `if os.PathSeparator == '\\' && strings.HasPrefix(path, "/") && len(path) >= 3 && path[2] == ':'` strips the leading `/` for `file:///c:/foo`. But for `file://localhost/c:/foo`, the `Host` branch (line 668-670) prepends `//localhost`, so `path` becomes `//localhost/c:/foo` — `path[2]` is now `l`, the strip branch is skipped, and the resulting absolute path is wrong on Windows. UNC pathing across drive letters is rare but legal.

8. **`byteOffsetToLSPPosition` is silently lossy on invalid UTF-8 (lsp.go:684-722).** When `utf8.DecodeRuneInString` returns `RuneError, 1`, the rune is counted as one UTF-16 unit (because `utf16.RuneLen(RuneError)` returns 1). This may not match what the editor expects for a malformed byte. The helper also breaks early when a rune straddles `offset` — correct for grapheme-aligned offsets, but no doc comment explains the contract.

9. **`RunLSPCommandIDs` and `RunLSPCodeActionKinds` still incur contributor-registration cost (lsp.go:78-85 + dispatch.go:52).** `registerContributors()` is called before the switch in `dispatch.go`, so the simplest metadata verbs pay the contributor walk + collision check + sort. For these two verbs the registration is unnecessary because the returned values are static. Move `registerContributors()` into the `default` branch of the inner switch, or special-case the two metadata verbs.

10. **No mutex around `registerContributors` (contrib_adapter.go:36-59).** The function writes to the package-global `registered.rules` via `Register(...)`. If `linthost.Main` is ever called concurrently from an in-process consumer (the wasm host), the map write races. Dispatcher comments hint this is single-call, but there's no `sync.Once` enforcing it.

11. **`copyLSPCommandWorkspaceEntry` symlink loop guard is per-call but does not actually prevent loops (lsp.go:485-542).** The `seenDirs` map is built per top-level `copyLSPCommandWorkspace` call, but the function uses `defer delete(seenDirs, realDir)` (line 504), which **removes the marker after the recursive call returns**. This defeats the loop-detection guard for siblings: if `a/link1 -> /shared` and `a/link2 -> /shared`, the second visit re-enters `/shared`. The guard only prevents reentry within the **same** recursion path, not across siblings — which is the more common loop shape. Drop the `defer delete` to make it persistent.

12. **`writeJSON(nil)` for an empty WorkspaceEdit (lsp.go:163-183 + 419-422).** When `original == next`, `workspaceEditForFullDocument` returns `nil`, and `RunLSPExecuteCommand` calls `writeJSON(edit)`, which marshals `(*lspWorkspaceEdit)(nil)` to `"null"`. The LSP spec allows `null` for an empty `workspace/executeCommand` response, so this is fine — but the wider `executeCommand` contract for VS Code's `vscode-languageclient` consumes the result via `executeCommand(...)` and may surface `null` as a generic "command failed" toast depending on client setup. Worth confirming with the VS Code extension.

## Findings — go.mod hygiene

1. **`go 1.26` requires the very latest Go (go.mod:3).** Confirmed `go version` reports `go1.26.0` in this environment. Third-party rule contributors on Go 1.25 cannot build against this module. The `go.mod` does not specify a `toolchain` directive that would let `go` auto-download a newer version. Either add `toolchain go1.26.0` or downgrade the language version to `go 1.23` (the lint code does not appear to use 1.26-only features).

2. **No `go.sum` shipped (verified: not in package.json `files`, not on disk).** Consumers and tests rely on the public Go module proxy to recompute hashes. This works only as long as the `v0.0.0` shim modules are reachable. If the proxy serves a different `v0.0.0` artifact than the in-tree shim, builds drift silently. Either ship `go.sum` or commit to using `go.work` overlays at build time (already done for tests via `scripts/test-go-lint.cjs`).

3. **No `replace` directives despite `packages/ttsc/go.mod` having 14 of them.** The `packages/lint/go.mod:5-12` comment claims "go mod tidy works against the public proxy" — meaning the shim modules are intentionally fetched from upstream. But a contributor working in a `go.work` overlay against an in-tree `typescript-go` checkout will find that the `@ttsc/lint` module pins `v0.0.0` whereas the contributor's overlay supplies a different pseudo-version. Mismatch path — the integration test scripts (`test-go-lint.cjs:58`) work around this with synthetic `go.work` files, but the public contract for "ship a third-party rule" is more fragile than the comment claims.

4. **Indirect dep `github.com/microsoft/typescript-go v0.0.0-20260429010842-56ab4af42157` (go.mod:33).** Pinned pseudo-version. If the upstream tag moves, the shim modules may evolve while `lint` stays pinned. No `// indirect` issue beyond the usual pseudo-version drift.

5. **Indirect dep `golang.org/x/text v0.35.0` (go.mod:37).** As of knowledge cutoff Jan 2026 this is current. No issue.

6. **`github.com/go-json-experiment/json` indirect (go.mod:31).** Pre-release JSON v2 package. Pulled transitively via typescript-go. No direct use in lint, but its presence in the module graph means an upstream API change could ripple into lint via the checker shim.

7. **Missing shim modules vs `packages/ttsc/go.mod`.** Lint omits `shim/lsp` and `shim/printer`. That's fine because `lsp.go` here implements its own byte-level LSP responses and never calls into the upstream LSP shim. Document this in the go.mod comment so a future maintainer doesn't add it back "for symmetry".

## Candidate proposals (to surface in discussion)

1. Add a `_test.go` in `test/plugin/` (or `test/rule/`) that asserts the three `rule.SeverityX` values equal the corresponding `linthost.SeverityX` values. Without this, the unchecked cast at `contrib_adapter.go:98` is a silent foot-gun.

2. Fix `NodeText` (astutil.go:40) to match its documented behavior — either drop the `TrimRight` or update the doc to mention trailing-whitespace stripping. Same review pass should add the missing `pos >= end` guard to `TokenRange`.

3. Update `plugin/main.go:3-16` to list all eleven verbs (or refactor to point readers at `dispatch.go` as the canonical list). Today's comment understates the surface.

4. Remove `--range-json` plumbing in `lsp.go` (lines 72, 192, 210) until a range-aware code action lands; carrying dead flags forward invites callers to depend on their presence.

5. Special-case empty input in `firstURIArgument` (lsp.go:644-657) so the caller sees "missing URI argument" instead of "invalid arguments JSON".

6. Make the workspace copy in `lspWorkspaceEditForCommand` lazier — at minimum, skip well-known build-output directories (`dist`, `build`, `.next`, `out`, `coverage`) in `shouldSkipLSPCommandWorkspaceDir` (lsp.go:544-551). Long term, copy only the files reachable from the tsconfig graph.

7. Decide whether the LSP command surface should consume `textDocument/didChange` content. Either document the "saved-file-only" semantics in `lsp.go` or wire in a content-aware path. The current behavior silently overwrites editor buffers (lsp.go:347 + 411).

8. Drop the `defer delete(seenDirs, realDir)` in `copyLSPCommandWorkspaceEntry` (lsp.go:504). The current pattern doesn't actually prevent symlink loops across sibling links.

9. Move `registerContributors()` out of `dispatch.go`'s pre-switch slot so the lightweight `lsp-command-ids` / `lsp-code-action-kinds` verbs don't pay registration cost. Guard the call with `sync.Once` in case an in-process consumer ever invokes `Main` twice.

10. Document the `astutil.FindKeyword` limitation that it doesn't skip string literals or comments. Either add the skip (calling into `shimscanner`) or warn callers in the doc comment that the helper is purely lexical.

11. Tighten `filePathFromURI`'s Windows handling (lsp.go:674) to handle UNC paths with drive letters. Reuse `vscode-uri` semantics in spirit.

12. Add a `panic`-recover wrapper at `plugin/main.go:33` so unexpected `init()` failures exit with code 2 and a clean stderr message instead of a raw Go stack trace.

13. Either commit `go.sum` or set `toolchain go1.26.0` in `go.mod` so off-tip Go users hit a clear error rather than a "shim v0.0.0 not found" mystery.

14. Update the `FixReporter` doc comment in `rule.go:112-127` to remove the contradiction about contributors "not implementing" the interface while also explaining how their test code must implement it.

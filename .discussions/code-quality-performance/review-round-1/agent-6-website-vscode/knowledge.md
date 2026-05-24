# Agent 6: Website, Playground, VSCode

Scope read: `website/src`, `website/build`, `website/compiler`, `website/src/content/docs`, package READMEs, and `packages/vscode`.

Product source was not edited. Existing unrelated working-tree edits were left untouched.

Validation run:

- `node -c website/build/compiler.cjs`
- `node -c website/build/deploy.cjs`
- `node -c packages/vscode/bin/install.js`
- `go test ./cmd/playground` from `website/compiler`
- `pnpm --dir website exec tsc -v` -> TypeScript 5.9.3
- `pnpm --filter @ttsc/vscode exec tsc -p packages/vscode/tsconfig.json --noEmit` could not run because this package has no local `tsc` binary.
- `pnpm --dir website exec tsc -p ../packages/vscode/tsconfig.json --noEmit` runs with TypeScript 5.9.3 and exposes tsconfig errors.

High-confidence proposals:

1. Honor the playground lint option and avoid target-tab reruns.
   `ITransformOptions.lint` exists and the options dialog toggles it, but `runLintImpl` always invokes `@ttsc/lint`; the run effect also depends on `target` while `mode` is unused. Skip lint when `opts.lint === false`, clear diagnostics, and remove `target` from the compile debounce until the worker has target-specific routes.

2. Limit project typia transform output to user playground sources.
   `runTypiaTransformProject` iterates every `prog.SourceFiles()` entry and returns all TypeScript text; the JS side writes every entry back into MemFS. The lint host already documents why raw `Program.SourceFiles()` includes imported libraries/generated/JSON modules. Emit only playground-owned source files, or only files with rewrites, to reduce browser JSON payload and MemFS churn.

3. Surface typia transform diagnostics.
   `applyTypiaTransform` says it returns stderr for caller diagnostics, and the Go transform encodes diagnostics, but `buildWithTypia` discards the result. Map transform diagnostics/stderr into the playground result before the subsequent build diagnostics.

4. Include Go module files in the playground wasm cache key.
   `newestMtime` only considers `.go` files, so changes to `website/compiler/go.mod` or `go.sum` can leave `playground.wasm` cached against stale dependencies. Include module files in the key or move to a content-hash/stamp.

5. Deduplicate/dispose Monaco extra libs.
   `SourceEditor` adds the 501 KB `typia-types.json` pack on every editor mount and discards the disposables. Keep a per-Monaco install guard or dispose handles on unmount.

6. Restore VSCode package typecheckability.
   `packages/vscode/tsconfig.json` inherits an invalid TypeScript 5.9 combination (`moduleResolution: "bundler"` with `module: "commonjs"`) and the base `ignoreDeprecations: "6.0"` is rejected by TypeScript 5.9.3. Align the package tsconfig with the esbuild flow, then keep a no-emit typecheck command for this package.

7. Refresh stale website compiler documentation.
   `website/README.md` and `website/public/compiler/README.md` still describe the playground as a future/main-thread TypeScript implementation with a lint subset. Current docs elsewhere correctly say the playground boots Go wasm in a Worker.

Lower-confidence / optional:

- Cap rendered array/object entries in `ConsoleViewer` to avoid huge React trees from user `console.log` output.
- Consider executing compiled playground JS in a separate Worker so infinite loops cannot freeze the UI thread.
- No high-confidence VSCode runtime bug found in `packages/vscode/src/extension.ts`; most behavior matches the README contract.

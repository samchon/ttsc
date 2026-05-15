# ttsc Guide Documents

These guides cover `ttsc` consumers, `ttsx` runtime users, bundler users, and plugin authors.

> Status: v1, still moving. Do not publish `ttsc` as a plugin dependency or peer dependency.

## Start Here

| Reader                                       | Start with                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| Application developer using `ttsc` or `ttsx` | [Consumer Quickstart](./00-consumer-quickstart.md)                              |
| Runtime user replacing `tsx` or `ts-node`    | [ttsx Runtime](./11-ttsx-runtime.md)                                            |
| Bundler user                                 | [`@ttsc/unplugin`](../packages/unplugin/)                                       |
| Transform plugin author                      | [Getting Started](./01-getting-started.md)                                      |
| Check or lint plugin author                  | [Protocol](./02-protocol.md) and [Reference Plugins](./10-reference-plugins.md) |
| Lint rule contributor (`@ttsc/lint` plugin)  | [Reference Plugins § Authoring a Lint Rule Contributor](./10-reference-plugins.md#authoring-a-lint-rule-contributor) |
| Workspace maintainer or releaser             | [Workspace Release](./12-workspace-release.md)                                  |

## Reading Order

Plugin authors should read:

1. [Getting Started](./01-getting-started.md) - build the smallest useful source transform plugin.
2. [Protocol](./02-protocol.md) - plugin package contract and binary subcommands.
3. [Reference Plugins](./10-reference-plugins.md) - guided tour of `banner`, `strip`, `paths`, and `lint`, grouped by difficulty.
4. [Recipes](./08-recipes.md) - focused patterns you can copy.
5. [AST and Checker](./03-tsgo.md) - TypeScript-Go AST traversal, text ranges, Program bootstrap, and Checker usage.
6. [Local Development](./04-local-dev.md) - `go.work`, gopls, `go test`, and pnpm notes.
7. [Testing](./07-testing.md) - Go unit tests and end-to-end `ttsc` fixtures.
8. [Publishing](./06-publishing.md) - npm package shape and pre-publish checks.
9. [Pitfalls](./09-pitfalls.md) - common first-hour failures.
10. [Internals](./05-internals.md) - source-plugin build cache and Go toolchain resolution.
11. [Workspace Release](./12-workspace-release.md) - repository build, test, tarball, platform package, and release flow.

## Repository References

Use these when reading real code:

- [`packages/banner`](../packages/banner/) - smallest transform plugin.
- [`packages/strip`](../packages/strip/) - source transform plugin with statement removal.
- [`packages/paths`](../packages/paths/) - transform plugin with tsconfig parsing and Program-backed path resolution.
- [`packages/lint`](../packages/lint/) - diagnostics plugin with Program/Checker access.
- [`tests/projects/go-source-plugin-checker`](../tests/projects/go-source-plugin-checker/) - minimal Program/Checker bootstrap fixture.
- [`tests/projects/go-source-plugin-properties`](../tests/projects/go-source-plugin-properties/) - AST traversal fixture.

## Requirements

- Node.js >= 18.
- `ttsc` installed in the consumer project.
- `@typescript/native-preview` installed in the consumer project.
- No system Go installation is required for consumers; `ttsc` uses its bundled Go toolchain. Plugin authors may install Go locally for direct `go test` / `go vet`.

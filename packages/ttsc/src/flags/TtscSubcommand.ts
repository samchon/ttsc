/**
 * Subcommands the ttsc CLI dispatches to. The bare `"ttsc"` entry covers the
 * default lane (no explicit subcommand, e.g. `ttsc -p tsconfig.json`).
 *
 * @evidence contracts/common.md#principled-implementation Literal command identities distinguish the default compiler lane from named launcher commands, matching the dispatch vocabulary used by flag selection.
 * @evidence contracts/common.md#clear-and-simple-design A single union records the permitted identities without adding a command registry or dispatch behavior to the representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The ttsc literal intentionally represents the product's default lane rather than a special case for any project or invocation fixture.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why the default lane has a named identity and gives its invocation meaning, applying the documentation skill's purpose and context guidance.
 */
export type TtscSubcommand =
  | "ttsc"
  | "build"
  | "cache"
  | "check"
  | "fix"
  | "format"
  | "prepare"
  | "clean";

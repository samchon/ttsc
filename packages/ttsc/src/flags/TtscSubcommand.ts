/**
 * Subcommands the ttsc CLI dispatches to. The bare `"ttsc"` entry covers the
 * default lane (no explicit subcommand, e.g. `ttsc -p tsconfig.json`).
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

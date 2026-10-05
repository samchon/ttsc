// Contributor plugin descriptor for `@ttsc/lint`.
//
// Mirrors the shape of an ESLint flat-config plugin object (meta, rules,
// configs, processors) with one extra field: `source`. The string points
// at this package's Go source directory, which ttsc's plugin builder
// statically links into `@ttsc/lint`'s binary at first build.
//
// The `rules` array is advisory — actual rule registration happens in
// the Go `init()` of `rules/no_todo_comment.go` via
// `rule.Register(noTodoComment{})`. Typed `demo/*` keys in the user's `rules`
// map come from `IDemoLintRules` below, not from this list.
import type { ITtscLintPlugin } from "@ttsc/lint";
import path from "node:path";

/**
 * Plugin descriptor for `@ttsc/lint`'s contributor demo.
 *
 * `source` points at the Go rules directory that `ttsc` statically links into
 * `@ttsc/lint`'s binary on first build. The `rules` tuple is advisory metadata
 * and `meta.version` follows this package's manifest.
 */
const plugin = {
  meta: {
    name: "lint-contributor-demo",
    version: (require("../package.json") as { version: string }).version,
    namespace: "demo",
  },
  rules: [
    "no-todo-comment",
    "capitalize-exports",
    "no-marker-comment",
  ] as const,
  source: path.resolve(__dirname, "..", "rules"),
} satisfies ITtscLintPlugin;

/**
 * Typed `demo/*` rule settings for `ITtscLintConfig`.
 *
 * Pass this interface as the generic argument of the config type, for example
 * `satisfies ITtscLintConfig<IDemoLintRules>`, so `demo/no-marker-comment` gets
 * exact `markers` checking and `demo/capitalize-exports` accepts a severity
 * only. A `demo/*` rule that is not listed here, and every config that omits
 * the generic, keeps the open `unknown`-options fallback. The Go rule's
 * `noMarkerCommentOptions` struct uses the same JSON key so the checked payload
 * decodes cleanly on the host side.
 */
export interface IDemoLintRules {
  /** `demo/no-marker-comment` accepts a `{ markers: string[] }` options blob. */
  "demo/no-marker-comment": {
    /** Comment substrings to flag. Defaults to `["TODO", "FIXME"]`. */
    markers?: readonly string[];
  };

  /** `demo/capitalize-exports` takes a severity and no options. */
  "demo/capitalize-exports": void;
}

export default plugin;

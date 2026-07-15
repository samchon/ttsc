// Contributor plugin descriptor for `@ttsc/lint`.
//
// Mirrors the shape of an ESLint flat-config plugin object (meta, rules,
// configs, processors) with one extra field: `source`. The string points
// at this package's Go source directory, which ttsc's plugin builder
// statically links into `@ttsc/lint`'s binary at first build.
//
// The `rules` array is advisory — actual rule registration happens in
// the Go `init()` of `rules/no_todo_comment.go` via
// `rule.Register(noTodoComment{})`. The literal tuple is `as const` so
// the host's `ITtscLintConfig` type can suggest valid
// `demo/no-todo-comment` keys in the user's `rules` map.
import type { ITtscLintPlugin, TtscLintRuleSetting } from "@ttsc/lint";
import path from "node:path";

/**
 * Plugin descriptor for `@ttsc/lint`'s contributor demo.
 *
 * `source` points at the Go rules directory that `ttsc` statically links into
 * `@ttsc/lint`'s binary on first build. The `rules` tuple is `as const` so
 * `ITtscLintConfig` can surface valid `demo/*` keys in the user's `rules` map
 * without a separate type file.
 */
const plugin = {
  meta: {
    name: "lint-contributor-demo",
    version: "0.10.2",
    namespace: "demo",
  },
  rules: [
    "no-todo-comment",
    "capitalize-exports",
    "no-marker-comment",
  ] as const,
  source: path.resolve(__dirname, "..", "rules"),
} satisfies ITtscLintPlugin;

// `demo/no-marker-comment` accepts a `{ markers: string[] }` options blob.
// Augmenting `ITtscLintRuleOptionsMap` adds this key to @ttsc/lint's mapped
// options overlay, which is intersected into `ITtscLintRules`. The known rule
// therefore gets exact `markers` checking while the contributor index
// signature remains an `unknown`-options fallback for plugins whose typings
// were not imported. The Go rule's `noMarkerCommentOptions` struct uses the
// same JSON key so the checked payload decodes cleanly on the host side.
declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    "demo/no-marker-comment": {
      /** Comment substrings to flag. Defaults to `["TODO", "FIXME"]`. */
      markers?: readonly string[];
    };
  }

  interface ITtscLintContributorRules {
    "demo/capitalize-exports"?: TtscLintRuleSetting;
  }
}

export default plugin;

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
// map come from the module augmentations below, not from this list.
import type { ITtscLintPlugin, TtscLintRuleSetting } from "@ttsc/lint";
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

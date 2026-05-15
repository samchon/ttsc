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
// the host's `TtscLintConfig` type can suggest valid
// `demo/no-todo-comment` keys in the user's `rules` map.
import type { ITtscLintPlugin } from "@ttsc/lint";
import path from "node:path";

const plugin = {
  meta: {
    name: "lint-contributor-demo",
    version: "0.10.2",
    namespace: "demo",
  },
  rules: ["no-todo-comment", "capitalize-exports"] as const,
  source: path.resolve(__dirname, "..", "rules"),
} satisfies ITtscLintPlugin;

export default plugin;

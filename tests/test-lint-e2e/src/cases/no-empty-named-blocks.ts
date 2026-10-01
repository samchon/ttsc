// Positive: empty named import clause without a default — the only
// effect is to load the module for its side effects, which `import "x"`
// expresses more clearly.
// expect: no-empty-named-blocks error
import {} from "x";

// Positive: empty named import clause alongside a default binding —
// the `{}` adds nothing once the default is present.
// expect: no-empty-named-blocks error
import defaultBinding, {} from "y";
void defaultBinding;

// Positive: empty `export {}` once the file is already a module via
// some other import/export — restates module-ness redundantly.
// expect: no-empty-named-blocks error
export {};

// Negative: non-empty named import — the rule only fires on empty clauses.
import { join } from "z";
void join;

// Negative: a side-effect import with no clause at all — the rule
// targets only the named-clause shape, not bare imports.
import "w";

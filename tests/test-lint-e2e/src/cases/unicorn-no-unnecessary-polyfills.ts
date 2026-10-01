// @ttsc-corpus-skip(options): rule diagnostics depend on a resolved target environment (the `targets` option, a Browserslist config, or a package.json `engines` field); the flat corpus supplies no per-rule options. Positive Go coverage lives at packages/lint/test/rules/unicorn/unicorn_no_unnecessary_polyfills_options_test.go.
// @ttsc-corpus-rule: unicorn/no-unnecessary-polyfills
import assign from "object-assign";

void assign;

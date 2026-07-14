// @ttsc-corpus-skip: unicorn/no-unnecessary-polyfills is implemented, but its diagnostics depend on resolved target environments (the `targets` option, a Browserslist config, or a package.json `engines` field) that the flat `// expect:` corpus runner cannot express — it only writes a `{ rules }` severity map. Behavioral coverage lives in the oracle-driven Go tests under packages/lint/test/rules/unicorn/ (unicorn_no_unnecessary_polyfills*_test.go), including the project-discovery scenario this fixture would otherwise exercise. This file remains as the link target referenced from packages/lint/README.md and website/src/content/docs/lint/rules/unicorn.mdx.
import assign from "object-assign";

void assign;

import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies prefer-as-const reaches all four upstream visitor families through
 * package auto-discovery, including type parentheses erased by ts-estree.
 *
 * The fixture intentionally omits `compilerOptions.plugins`. Its package.json
 * dependency and discovered lint.config.json are the only activation path.
 * Raw-spelling and accessor negatives keep the rule from broadening beyond the
 * upstream contract while the exact diagnostic set pins every visitor family.
 */
export const test_lint_prefer_as_const_covers_all_rule_families_without_plugins_entry =
  () => {
    const result = runLint({
      name: "prefer-as-const-no-plugins-entry",
      source: `const asserted = "asserted" as ("asserted");
const angled = <("angled")>"angled";
let variable: ("variable") = "variable";
class Holder {
  public readonly property: ("property") = "property";
  accessor tracked: ("tracked") = "tracked";
}
const differentQuotes = 'different' as ("different");
let differentNumeric: (10) = 0xa;

JSON.stringify(asserted, angled, variable, new Holder(), differentQuotes, differentNumeric);
`,
      rules: { "typescript/prefer-as-const": "error" },
      extraSources: {
        "tsconfig.json": JSON.stringify(
          {
            compilerOptions: {
              noEmit: true,
              strict: true,
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
            },
            files: ["src/main.ts"],
          },
          null,
          2,
        ),
        "package.json": JSON.stringify(
          {
            name: "prefer-as-const-no-plugins-entry-fixture",
            private: true,
            dependencies: { "@ttsc/lint": "*" },
          },
          null,
          2,
        ),
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map(({ rule, severity, line }) => ({
        rule,
        severity,
        line,
      })),
      [
        { rule: "typescript/prefer-as-const", severity: "error", line: 1 },
        { rule: "typescript/prefer-as-const", severity: "error", line: 2 },
        { rule: "typescript/prefer-as-const", severity: "error", line: 3 },
        { rule: "typescript/prefer-as-const", severity: "error", line: 5 },
      ],
      result.stderr,
    );
  };

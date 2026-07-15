import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies lint expectations: malformed and targetless markers fail loudly.
 *
 * Discovery previously interpreted a parser miss as "not a fixture", so one
 * typo could remove coverage. Every marker-shaped line must either parse and
 * reach a target or throw before corpus partitioning, even after valid
 * markers.
 *
 * 1. Parse malformed line, JSX-block, and mixed marker stacks.
 * 2. Parse valid markers at end-of-file with no following source line.
 * 3. Assert every invalid form reports its line and failure category.
 */
export const test_lint_expectation_parser_rejects_malformed_or_targetless_markers =
  (): void => {
    for (const [source, pattern] of [
      ["// expect: rule/name fatal\nconst x = 1;", /malformed.*line 1/],
      ["// expect : rule/name error\nconst x = 1;", /malformed.*line 1/],
      [
        "// expect: first/rule error\nconst first = 1;\n// expect second/rule warn\nconst second = 2;",
        /malformed.*line 3/,
      ],
      [
        "// expect: first/rule error\nconst first = 1;\n// expect second/rule\nconst second = 2;",
        /malformed.*line 3/,
      ],
      [
        "// expect: first/rule error\nconst first = 1;\n// expect second/rule warn trailing\nconst second = 2;",
        /malformed.*line 3/,
      ],
      ["{/* expect: rule\/name error *\/\nconst x = 1;", /malformed.*line 1/],
      ["{ /* expect : rule/name error */ }\nconst x = 1;", /malformed.*line 1/],
      [
        "{ /* expect: first/rule error */ }\n<div />\n{ /* expect second/rule warn */ }\n<span />",
        /malformed.*line 3/,
      ],
      [
        "{ /* expect: first/rule error */ }\n<div />\n{ /* expect second/rule */ }\n<span />",
        /malformed.*line 3/,
      ],
      [
        "// expect: first/rule error\n{ /* expect: second/rule fatal */ }\nconst x = 1;",
        /malformed.*line 2/,
      ],
      [
        "const x = 1;\n// expect: rule/name error",
        /line 2.*no following target/,
      ],
      [
        "const x = 1;\n{/* expect: rule/name warn */}",
        /line 2.*no following target/,
      ],
    ] as const) {
      assert.throws(() => TestLint.parseExpectations(source), pattern);
    }
  };

import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";

/**
 * Verifies playground package discovery: a static template is a specifier, a
 * spread require is a call, and a private-name call is not the free binding.
 *
 * A template without a substitution or an escape is a constant string, so
 * `require(`a`)` and `import(`b`)` request the same package as the quoted form.
 * A substitution or an escape makes the value depend on evaluation, so those
 * stay uncollected like any computed argument. A template can never follow
 * `import` or `from` in a declaration, so those forms are invalid JavaScript
 * and request nothing. `[...require("e")]` is a real call whose three dots are
 * a spread rather than a member access, while `this.#require("f")` calls a
 * private method.
 *
 * 1. Collect a source holding static-template calls, spread and quoted
 *    declarations as positive controls.
 * 2. Hold substitution, escape, private-name, member and declaration-template
 *    lookalikes in the same source, each on its own statement.
 * 3. Require exactly the positive packages, in sorted order.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls collectExternalPackageNames with one mixed source; the exact dependency list must name the static-template calls, the spread require and the quoted declarations, and omit every lookalike.
 * @evidence contracts/testing.md#independent-expectations ECMAScript defines a template without substitutions or escapes as a constant string and treats `...` as spread syntax and `#name` as a private name; the literal sorted list follows from those rules, not from the collector's tokenizer.
 * @evidence contracts/testing.md#distinguishing-cases The substitution, escape, private-name call, optional member call and declaration-template lookalikes each differ from a collected neighbor in one property (a substitution, an escape, a `#` or `?.` prefix, a template where a quoted string is required), so each one distinguishes the recognition rule that admits its collected neighbor.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry calls the authored lexical collector over one in-memory source in the playground batch; no compiler, process, installation or native producer runs.
 */
export const test_collect_external_package_names_reads_static_templates_and_skips_private_calls =
  () => {
    const source = [
      "require(`a`);",
      "import(`b`);",
      "require(`c${x}`);",
      "require(`d" + String.fromCharCode(92) + "x41`);",
      'const e = [...require("e")];',
      'this.#require("f");',
      "import `h`;",
      "import x from `i`;",
      'import j from "j";',
      'import "k";',
      'obj?.require("m");',
    ].join("\n");

    assert.deepEqual(collectExternalPackageNames(source, []), [
      "a",
      "b",
      "e",
      "j",
      "k",
    ]);
  };

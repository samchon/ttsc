import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";

/**
 * Verifies playground package discovery: scans executable template
 * substitutions.
 *
 * Template quasis are inert text, but `${...}` is ordinary JavaScript. The
 * collector must recurse into substitutions without weakening its comment,
 * string, regular-expression, computed-specifier, or nested-template guards.
 *
 * 1. Collect literal `import` and `require` calls inside ordinary, tagged, and
 *    nested template substitutions.
 * 2. Keep raw template text and lookalikes inside comments, strings, regexes, and
 *    computed arguments inert, including a regex body containing `}`.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls collectExternalPackageNames with ordinary, tagged and nested templates; the exact six dependencies must come from executable substitutions while raw text and inert lookalikes remain absent.
 * @evidence contracts/testing.md#independent-expectations JavaScript template quasis are text and substitutions are expressions. The literal sorted list names only static import/require arguments in those expressions, independently of recursive tokenization.
 * @evidence contracts/testing.md#distinguishing-cases Raw require text, substitution comments/strings/regexes, a regex containing a closing brace, division, nested substitutions and computed import arguments distinguish recursion from raw-text scanning and premature brace termination. A member require call remains inert.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry calls the authored lexical collector with one in-memory mixed fixture in the playground batch. It starts no compiler, process protocol, installation or native producer; the wide-substitution unit owns the size boundary separately.
 */
export const test_collect_external_package_names_reads_template_substitutions =
  () => {
    const source = [
      'const raw = `require("raw-template-text")`;',
      'const imported = `${await import("inside-import")}`;',
      'const required = `${require("inside-require")}`;',
      'const nested = `${`${require("nested-require")}`}`;',
      'const tagged = tag`${import("tagged-import")}`;',
      'const comment = `${/* require("comment-ghost") */ "ok"}`;',
      'const string = `${"import(\\"string-ghost\\")"}`;',
      'const regex = `${/require\\("regex-ghost"\\)/.test("x")}`;',
      'const regexBrace = `${/}/.test("x") ? require("after-regex") : null}`;',
      'const division = `${value / 2 ? require("after-division") : null}`;',
      "const computed = `${import(`computed-${name}`)}`;",
      'obj.require("method-ghost");',
    ].join("\n");

    assert.deepEqual(collectExternalPackageNames(source, []), [
      "after-division",
      "after-regex",
      "inside-import",
      "inside-require",
      "nested-require",
      "tagged-import",
    ]);
  };

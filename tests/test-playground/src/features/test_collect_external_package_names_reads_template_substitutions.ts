import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/lib/src/npm/collectExternalPackageNames.js";

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

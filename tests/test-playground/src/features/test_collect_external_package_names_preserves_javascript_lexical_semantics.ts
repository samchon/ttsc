import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";
import { installPlaygroundDependencies } from "../../../../packages/playground/src/npm/installPlaygroundDependencies";

/**
 * Verifies package discovery reads quoted strings and slashes with the lexical
 * semantics of JavaScript.
 *
 * Dependency discovery must use the same cooked quoted-string values and slash
 * boundaries as JavaScript while recognizing only a direct optional CommonJS
 * call. Malformed literals fail closed, and inert lookalikes remain opaque.
 *
 * 1. Collect specifiers written with hex, unicode, code-point, line-continuation,
 *    simple and quote escapes, and require their cooked values.
 * 2. Require malformed literals to fail closed without hiding a later valid
 *    import, and optional calls to count only when made directly on the require
 *    binding.
 * 3. Pass a cooked name to the installer and require the registry request to carry
 *    the cooked name rather than its escape spelling.
 *
 * @evidence contracts/testing.md#behavioral-verification collectExternalPackageNames decodes executable import and direct optional require literals while ignoring malformed strings, comments, regex text and object methods. The cooked package name is passed into the authored dependency installer request path.
 * @evidence contracts/testing.md#independent-expectations Literal expected cooked characters follow JavaScript string-escape and line-continuation semantics; explicit package arrays distinguish executable syntax from inert text. A recording fetch rejects before any network access and independently captures the requested registry name.
 * @evidence contracts/testing.md#distinguishing-cases Hex, fixed Unicode, code-point, quote, NUL, six simple escapes and five newline continuations preserve their cooked values. Malformed escapes and unterminated quotes contrast with a later valid import; postfix division, regexes, direct optional calls and method lookalikes retain separate controls.
 * @evidence contracts/testing.md#execution-ownership This exported asynchronous source unit calls the authored collector and installer with in-memory source strings and a recording fetch function. No archive is fetched or installed, and no compiler or host process starts; its existing literal fixtures and request assertions execute once here.
 */
export const test_collect_external_package_names_preserves_javascript_lexical_semantics =
  async () => {
    const escapedSource = [
      "import \"hex\\x2dpackage\";",
      "export {} from \"fixed\\u002dpackage\";",
      "void import(\"point\\u{2d}package\");",
      "require(\"slash\\\\package\");",
    ].join("\n");
    assert.deepEqual(collectExternalPackageNames(escapedSource, []), [
      "fixed-package",
      "hex-package",
      "point-package",
      "slash\\package",
    ]);
    for (const terminator of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
      assert.deepEqual(
        collectExternalPackageNames(
          'require("continued\\' + terminator + 'package");',
          [],
        ),
        ["continuedpackage"],
        "a quoted line continuation contributes no line terminator",
      );
    }
    for (const [escape, cookedCharacter] of [
      ["b", "\b"],
      ["f", "\f"],
      ["n", "\n"],
      ["r", "\r"],
      ["t", "\t"],
      ["v", "\v"],
    ] as const) {
      assert.deepEqual(
        collectExternalPackageNames(`require("simple\\${escape}package");`, []),
        [`simple${cookedCharacter}package`],
        `\\${escape} must contribute its cooked character`,
      );
    }
    assert.deepEqual(
      collectExternalPackageNames("require(\"quote\\\"package\");", []),
      ['quote"package'],
      "an escaped quote contributes to the value without ending the literal",
    );
    assert.deepEqual(
      collectExternalPackageNames("require(\"nul\\0package\");", []),
      ["nul\0package"],
    );

    const malformed = [
      "import \"bad\\xG1\";",
      "require(\"bad\\u{}\");",
      "export {} from \"bad\\u{110000}\";",
      'import "unterminated',
      'import "after-malformed";',
    ].join("\n");
    assert.deepEqual(collectExternalPackageNames(malformed, []), [
      "after-malformed",
    ]);

    const operatorsAndOptionalCalls = [
      'value++ / divisor; import("after-increment") / next;',
      'value-- / divisor; require?.("after-decrement");',
      'const regex = /require?.("regex-ghost")/; import("after-regex");',
      'require?.("optional-package");',
      'obj.require?.("method-ghost");',
      'obj?.require?.("optional-method-ghost");',
      "require?.(computedSpecifier);",
      'const text = "require?.(\\"string-ghost\\")";',
      '// require?.("comment-ghost")',
    ].join("\n");
    assert.deepEqual(
      collectExternalPackageNames(operatorsAndOptionalCalls, []),
      ["after-decrement", "after-increment", "after-regex", "optional-package"],
    );

    // The cooked name, never its source escape spelling, reaches the installer.
    const cooked = collectExternalPackageNames(
      "import \"pkg\\u002dname\";",
      [],
    );
    assert.deepEqual(cooked, ["pkg-name"]);
    const registryCalls: string[] = [];
    await assert.rejects(
      installPlaygroundDependencies(cooked, {
        fetch: (url: string): Promise<Response> => {
          registryCalls.push(url);
          return Promise.reject(new Error("stop after recording"));
        },
      }),
    );
    assert.ok(
      registryCalls.some((url) => url.includes("pkg-name")),
      "the registry request must use the cooked package name",
    );
    assert.ok(
      registryCalls.every((url) => !url.includes("pkgu002dname")),
      "the escape spelling must never reach the registry",
    );
  };

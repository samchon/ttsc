import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/lib/src/npm/collectExternalPackageNames.js";
import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/npm/installPlaygroundDependencies.js";

/**
 * Dependency discovery must use the same cooked quoted-string values and slash
 * boundaries as JavaScript while recognizing only a direct optional CommonJS
 * call. Malformed literals fail closed, and inert lookalikes remain opaque.
 */
export const test_collect_external_package_names_preserves_javascript_lexical_semantics =
  async () => {
    const escapedSource = [
      String.raw`import "hex\x2dpackage";`,
      String.raw`export {} from "fixed\u002dpackage";`,
      String.raw`void import("point\u{2d}package");`,
      String.raw`require("slash\\package");`,
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
      collectExternalPackageNames(String.raw`require("quote\"package");`, []),
      ['quote"package'],
      "an escaped quote contributes to the value without ending the literal",
    );
    assert.deepEqual(
      collectExternalPackageNames(String.raw`require("nul\0package");`, []),
      ["nul\0package"],
    );

    const malformed = [
      String.raw`import "bad\xG1";`,
      String.raw`require("bad\u{}");`,
      String.raw`export {} from "bad\u{110000}";`,
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
      String.raw`import "pkg\u002dname";`,
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

import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/lib/src/npm/collectExternalPackageNames.js";
import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/npm/installPlaygroundDependencies.js";

/**
 * Npm dependency discovery must originate only from executable module-loading
 * syntax. Import/export/require lookalikes inside comments, string and template
 * contents, and regex literals are inert text and must never become
 * package-download requests.
 *
 * RA-11 (#669): the pre-fix collector regex ran over raw source, so a comment
 * copied from docs or a string used as test data changed which packages the
 * playground tried to install.
 *
 * 1. A mixed source produces exactly the real specifiers' package names —
 *    static/side-effect/dynamic imports, `export … from`, and `require(...)` —
 *    while every commented/quoted/templated/regex lookalike is excluded.
 * 2. Boundary: `obj.require(...)`, unresolvable template specifiers, scoped names,
 *    subpaths, built-ins, relative paths, and duplicates behave per the
 *    normalization contract.
 * 3. Integration: a phantom-only source yields no packages, so the installer
 *    performs zero network calls — proving inert text never reaches the npm
 *    download stage — while a real import does reach the registry.
 */
export const test_collect_external_package_names_ignores_non_code =
  async () => {
    const mixed = [
      `// import "line-comment-ghost";`,
      `/* export { a } from "block-comment-ghost"; */`,
      `const s = "require('string-ghost')";`,
      'const t = `import "template-ghost"`;',
      `const re = /import "regex-ghost" from "y"/;`,
      `import "real-side-effect";`,
      `import def from "real-default";`,
      `import { a } from "real-named";`,
      `export { b } from "real-reexport";`,
      `export * from "real-star";`,
      `const d = await import("real-dynamic");`,
      `const c = require("real-require");`,
      `import type { T } from "real-type-only";`,
      `import "@scope/real-scoped";`,
      `import x from "real-subpath/deep/mod";`,
      `import again from "real-default";`, // duplicate collapses
      // Boundary specifiers that must be excluded:
      "const tmpl = require(`unresolvable-${name}`);",
      `obj.require("method-require-ghost");`,
      `import "./relative-ignored";`,
      `import "../parent-ignored";`,
      `import * as fs from "path";`, // node built-in
      `import "node:crypto";`,
    ].join("\n");

    const names = collectExternalPackageNames(mixed, []);
    assert.deepEqual(
      names,
      [
        "@scope/real-scoped",
        "real-default",
        "real-dynamic",
        "real-named",
        "real-reexport",
        "real-require",
        "real-side-effect",
        "real-star",
        "real-subpath",
        "real-type-only",
      ],
      `collector must yield only real specifiers; got ${JSON.stringify(names)}`,
    );

    // Negative twin: the very same specifiers, when they are real code rather than
    // comment/string/regex text, DO produce the package names — proving the
    // exclusions above are about lexical context, not the tokens themselves.
    assert.deepEqual(
      collectExternalPackageNames(
        `import "line-comment-ghost";\nexport { a } from "block-comment-ghost";\nconst g = require("string-ghost");`,
        [],
      ),
      ["block-comment-ghost", "line-comment-ghost", "string-ghost"],
    );

    // Ignored-package filtering still applies to real imports.
    assert.deepEqual(
      collectExternalPackageNames(`import "typia";\nimport "keep-me";`, [
        "typia",
      ]),
      ["keep-me"],
    );

    // Boundary: escaped quotes inside a string keep import-like text inert; the
    // tokenizer decodes `\"` while scanning the literal, so the embedded
    // specifier never closes the string early or leaks a package. A real import
    // after the string is still discovered.
    assert.deepEqual(
      collectExternalPackageNames(
        [
          `const evil = "a \\"import y from 'ghost-escaped'\\" b";`,
          `import "real-after-escape";`,
        ].join("\n"),
        [],
      ),
      ["real-after-escape"],
    );

    // Integration: phantom-only source installs nothing (no network at all).
    const phantomOnly = [
      `// import "ghost-a";`,
      `const x = "require('ghost-b')";`,
      `/* export { z } from "ghost-c"; */`,
    ].join("\n");
    const phantomNames = collectExternalPackageNames(phantomOnly, []);
    assert.deepEqual(phantomNames, [], "phantom-only source collects nothing");

    const phantomCalls: string[] = [];
    await installPlaygroundDependencies(phantomNames, {
      fetch: (url: string): Promise<Response> => {
        phantomCalls.push(url);
        return Promise.reject(new Error("network must not be reached"));
      },
    });
    assert.equal(
      phantomCalls.length,
      0,
      "phantom text must never reach the npm download stage",
    );

    // Positive wiring check: a real import DOES reach the registry, so the
    // zero-call result above is not vacuous.
    const realNames = collectExternalPackageNames(`import "real-package";`, []);
    assert.deepEqual(realNames, ["real-package"]);
    const realCalls: string[] = [];
    await assert.rejects(
      installPlaygroundDependencies(realNames, {
        fetch: (url: string): Promise<Response> => {
          realCalls.push(url);
          return Promise.reject(new Error("stop after recording"));
        },
      }),
    );
    assert.ok(
      realCalls.some((u) => u.includes("real-package")),
      "a real import must reach the registry resolve step",
    );
  };

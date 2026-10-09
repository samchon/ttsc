import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { isProjectWalkPath } from "../../../../../packages/unplugin/src/core/transform/project/isProjectWalkPath";
import { reportsProgramMembership } from "../../../../../packages/unplugin/src/core/transform/project/reportsProgramMembership";
import { walkProjectInputs } from "../../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import { matchesCachedSource } from "../../../../../packages/unplugin/src/core/transform/validation/matchesCachedSource";
import type { ITtscProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/ITtscProjectMembershipPolicy";
import { compile } from "../../../../../packages/unplugin/src/core/tsconfig/compile";
import { matchesProjectRootFile } from "../../../../../packages/unplugin/src/core/tsconfig/matchesProjectRootFile";
import { matchesRootComponent } from "../../../../../packages/unplugin/src/core/tsconfig/matchesRootComponent";
import { selectReferencedProject } from "../../../../../packages/unplugin/src/core/tsconfig/selectReferencedProject";
import { TestProject } from "../../../../utils/src/TestProject";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies root wildcards merge equivalent searches and preserve Unicode
 * policy.
 *
 * Repeated star/literal pairs used to enumerate many partitions on a late miss.
 * Counted literal predicates measure actual component comparisons; the bound
 * follows token and candidate dimensions rather than an elapsed deadline.
 *
 * 1. Match both native grammars and case policies against literal semantic rows
 *    and the previous short-pattern regular-expression language.
 * 2. Count component literal comparisons on increasingly repeated stars, with both
 *    a matching suffix and a late missing suffix.
 * 3. Exercise walk/event admission, cached absence and referenced-project
 *    selection on one real project, then edit and restore its recorded input.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual compile, matchesRootComponent and matchesProjectRootFile preserve wildcard, Unicode, literal, directory, hidden/package/min.js/JSON and alias answers. Real walk, membership event classification, cached-source validation and reference selection exercise the repeated-star policy through their owning APIs.
 * @evidence contracts/testing.md#independent-expectations Literal rows specify compiler-language answers, including one-code-point question marks and Unicode simple folding without normalization. A short-input legacy regexp oracle independently recognizes the former component language; it is never used on adversarial long patterns. Counted RegExp subclasses delegate literal comparison while observing calls, and the token-times-code-point upper bound follows finite distinct positions rather than observed timing. Literal planted membership and referenced config names prescribe consumer results; filesystem captures supply setup evidence only.
 * @evidence contracts/testing.md#distinguishing-cases Positive and late-negative repeated-star cases span four pattern sizes; empty matches, consecutive stars, escaped metacharacters, astral/lone-surrogate/combining text, case folding, full-string anchors, hidden/package/minified/JSON rules, recursive and implicit directories, root aliases, unknown policies and invalid trailing recursion have adjacent controls. Recorded source edits reject cached absence and restoration recovers it.
 * @evidence contracts/testing.md#execution-ownership One source unit owns a temporary native project and direct policy/validation calls. Counted literal RegExp instances are authored subclasses, not mutations of foreign methods or globals. The handwritten successful envelope is consumer input, not a compiler execution or emulation; no installation, native build, compiler or watch broker runs.
 */
export function test_root_component_matching_has_bounded_unicode_states(): void {
  for (const platform of ["linux", "win32"] as const) {
    const base = platform === "win32" ? "C:/project" : "/project";
    const policy = (
      include: string[],
      caseSensitive: boolean,
      files: string[] = [],
    ): ITtscProjectMembershipPolicy => ({
      rootFileSpecs: {
        files: files.map((file) => `${base}/${file}`),
        include: include.map((spec) => `${base}/${spec}`),
      },
      excludedDirectories: [],
      inputExtensions: [".ts", ".js", ".json"],
      sources: [],
      useCaseSensitiveFileNames: caseSensitive,
    });
    const rows: [string, string, boolean, boolean][] = [
      ["?.ts", "\u{1f600}.ts", true, true],
      ["??.ts", "\u{1f600}.ts", true, false],
      ["?.ts", "\ud800.ts", true, true],
      ["?.ts", "e\u0301.ts", true, false],
      ["??.ts", "e\u0301.ts", true, true],
      ["?.ts", "\u00e9.ts", true, true],
      ["*a.ts", ".a.ts", true, false],
      [".*.ts", ".a.ts", true, true],
      ["foo*.ts", "foo.hidden.ts", true, true],
      ["a*.ts", "a.ts\n", true, false],
      ["a*.ts", "a\n.ts", true, true],
      ["a[1]*.ts", "a[1].ts", true, true],
      ["a[1]*.ts", "a1.ts", true, false],
      ["{a,b}*.ts", "a.ts", true, false],
      ["\u03a3*.ts", "\u03c2.ts", false, true],
      ["K*.ts", "\u212a.ts", false, true],
      ["S*.ts", "\u017f.ts", false, true],
      ["\u{10400}?.ts", "\u{10428}a.ts", false, true],
      ["\u00df?.ts", "ssa.ts", false, false],
      ["\u00e9*.ts", "e\u0301.ts", false, false],
      ["S*.ts", "\u017f.ts", true, false],
      ["**/main.ts", "main.ts", true, true],
      ["**/main.ts", "a/b/main.ts", true, true],
      ["lib", "lib/sub/main.ts", true, true],
      ["**/*", "node_modules/main.ts", true, false],
      ["node_modules/*.ts", "node_modules/main.ts", true, true],
      ["**/*", ".hidden/main.ts", true, false],
      [".hidden/*.ts", ".hidden/main.ts", true, true],
      ["**/*", "bundle.min.js", true, false],
      ["*.min.js", "bundle.min.js", true, true],
      ["*", "data.json", true, false],
      ["*.json", "data.json", true, true],
    ];
    for (const [spec, name, sensitive, expected] of rows)
      assert.equal(
        matchesProjectRootFile(
          `${base}/${name}`,
          policy([spec], sensitive),
          false,
          platform,
        ),
        expected,
        `${platform} ${spec} ${JSON.stringify(name)} sensitive=${sensitive}`,
      );
    assert.equal(
      matchesProjectRootFile(
        `${base}/literal*?.json`,
        policy([], false, ["literal*?.json"]),
        false,
        platform,
      ),
      true,
    );
    assert.equal(
      matchesProjectRootFile(
        `${base}/literalXX.json`,
        policy([], false, ["literal*?.json"]),
        false,
        platform,
      ),
      false,
    );
    assert.equal(
      matchesProjectRootFile(
        `${base}/artifact.ts`,
        policy(["*.ts"], true),
        true,
        platform,
      ),
      false,
    );
    assert.equal(
      matchesProjectRootFile(
        `${base}/lib`,
        policy(["lib"], true),
        true,
        platform,
      ),
      true,
    );
    assert.equal(compile(`${base}/**`, false, true, platform), undefined);
    assert.equal(
      matchesProjectRootFile(
        `${base}/anything.ts`,
        { ...policy([], true), rootFileSpecs: undefined },
        false,
        platform,
      ),
      true,
    );
    const aliases = policy(["src/*a*b.ts"], true);
    const physical = `${base}-physical`;
    const aliased = {
      ...aliases,
      rootFileSpecs: {
        ...aliases.rootFileSpecs!,
        root: { path: base, realpath: physical },
      },
    };
    assert.equal(
      matchesProjectRootFile(
        `${physical}/src/aaab.ts`,
        aliased,
        false,
        platform,
      ),
      true,
    );
    assert.equal(
      matchesProjectRootFile(
        `${physical}/src/aaa.ts`,
        aliased,
        false,
        platform,
      ),
      false,
    );

    for (const sensitive of [true, false])
      for (const spec of [
        "*",
        "?",
        "***",
        "*a*",
        "a??b",
        "*a*a*b",
        "[a]*",
        "a.b?",
        "\u03a3*",
        "\u{10400}?",
        "?*?",
        ".*",
      ])
        for (const name of [
          "",
          "a",
          "b",
          "aaab",
          "a.bx",
          "[a]",
          ".a",
          "a\n",
          "a\r\n",
          "\u03c2",
          "\u{10428}a",
          "\u{1f600}",
          "\ud800",
          "e\u0301",
        ]) {
          const pattern = compile(
            `${base}/${spec}`,
            false,
            sensitive,
            platform,
          )!;
          const component = pattern.components.at(-1)!;
          assert.notEqual(typeof component, "string");
          if (typeof component === "string")
            throw new Error("Expected a wildcard component");
          const escaped = [...spec]
            .map((char) =>
              char === "*"
                ? "[^/]*"
                : char === "?"
                  ? "[^/]"
                  : char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"),
            )
            .join("");
          const reference = new RegExp(
            `^${spec.startsWith("*") || spec.startsWith("?") ? "(?!\\.)" : ""}${escaped}$`,
            sensitive ? "u" : "iu",
          );
          assert.equal(
            matchesRootComponent(name, component.expression),
            reference.test(name),
            `${platform} ${spec} ${JSON.stringify(name)}`,
          );
        }
  }

  for (const stars of [6, 12, 24, 48]) {
    let comparisons = 0;
    class CountedLiteral extends RegExp {
      override test(value: string): boolean {
        comparisons++;
        return super.test(value);
      }
    }
    const tokens: ("*" | "?" | RegExp)[] = [];
    for (let i = 0; i < stars; i++)
      tokens.push("*", new CountedLiteral("^a$", "u"));
    tokens.push(new CountedLiteral("^b$", "u"));
    for (const [candidate, expected] of [
      [`${"a".repeat(128)}b`, true],
      ["a".repeat(128), false],
    ] as const) {
      comparisons = 0;
      assert.equal(matchesRootComponent(candidate, tokens), expected);
      assert.ok(comparisons > 0);
      assert.ok(
        comparisons <= tokens.length * [...candidate].length,
        `literal comparisons ${comparisons} exceed the token/character bound`,
      );
    }
    const policy: ITtscProjectMembershipPolicy = {
      rootFileSpecs: {
        files: [],
        include: [`/project/${"*a".repeat(stars)}b.ts`],
      },
      excludedDirectories: [],
      inputExtensions: [".ts"],
      sources: [],
      useCaseSensitiveFileNames: true,
    };
    assert.equal(
      matchesProjectRootFile(
        `/project/${"a".repeat(128)}b.ts`,
        policy,
        false,
        "linux",
      ),
      true,
    );
    assert.equal(
      matchesProjectRootFile(
        `/project/${"a".repeat(128)}.ts`,
        policy,
        false,
        "linux",
      ),
      false,
    );
  }

  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-bounded-root-component-"),
  );
  const admitted = `${"a".repeat(30)}b.ts`;
  const rejected = `${"a".repeat(30)}.ts`;
  const source = "export const value = 1;\n";
  const config = JSON.stringify({ include: [`src/${"*a".repeat(12)}b.ts`] });
  TestProject.writeFiles(root, {
    [`src/${admitted}`]: source,
    [`src/${rejected}`]: "export const unrelated = 1;\n",
    "tsconfig.json": config,
    "solution.json": JSON.stringify({
      files: [],
      references: [{ path: "./declines.json" }, { path: "./tsconfig.json" }],
    }),
    "declines.json": JSON.stringify({
      include: [`src/${"*a".repeat(12)}z.ts`],
    }),
  });
  const cached = observeValidationUnitGeneration(root, {
    type: "success",
    typescript: { [`src/${admitted}`]: source },
  });
  const included = path.join(root, "src", admitted);
  const excluded = path.join(root, "src", rejected);
  assert.deepEqual(
    walkProjectInputs(
      root,
      DEFAULT_FILESYSTEM_OPERATIONS,
      cached.membershipPolicy,
    ).files,
    [included],
  );
  for (const [file, expected] of [
    [included, true],
    [excluded, false],
  ] as const) {
    assert.equal(
      isProjectWalkPath(
        root,
        file,
        undefined,
        DEFAULT_FILESYSTEM_OPERATIONS,
        cached.membershipPolicy,
      ),
      expected,
    );
    assert.equal(
      reportsProgramMembership(
        root,
        file,
        path.basename(file),
        cached.membershipPolicy,
        DEFAULT_FILESYSTEM_OPERATIONS,
      ),
      expected,
    );
  }
  assert.equal(
    matchesCachedSource(
      cached,
      excluded,
      fs.readFileSync(excluded, "utf8"),
      undefined,
    ),
    true,
  );
  fs.writeFileSync(included, "export const value = 2;\n");
  assert.equal(
    matchesCachedSource(
      cached,
      excluded,
      fs.readFileSync(excluded, "utf8"),
      undefined,
    ),
    false,
  );
  fs.writeFileSync(included, source);
  assert.equal(
    matchesCachedSource(
      cached,
      excluded,
      fs.readFileSync(excluded, "utf8"),
      undefined,
    ),
    true,
  );
  const selection = selectReferencedProject(
    included,
    path.join(root, "solution.json"),
  );
  assert.equal(selection.tsconfig, path.join(root, "tsconfig.json"));
  assert.ok(selection.consulted.includes(path.join(root, "declines.json")));
  assert.equal(
    selectReferencedProject(excluded, path.join(root, "solution.json"))
      .tsconfig,
    path.join(root, "solution.json"),
  );
}

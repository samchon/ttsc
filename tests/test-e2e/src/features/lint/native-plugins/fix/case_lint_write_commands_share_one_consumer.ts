import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

import { Scenarios } from "../../../../internal/Scenarios";
import { LintWorkspace } from "../../../../internal/lint/LintWorkspace";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/lint/internal/plugin-cache";

const FIX_FILES = [
  "fix/native.ts",
  "fix/contributor.ts",
  "fix/generic/case.tsx",
  "fix/generic/module.mts",
  "fix/generic/commonjs.cts",
  "fix/generic/plain.ts",
] as const;
const FORMAT_FILE = "format/semi.ts";

/**
 * Publishes builtin and contributor fixes, then format-only edits in one real
 * consumer project. Its dependency marker auto-discovers lint, and its single
 * tsconfig selects all source grammars together. The two command policies use
 * two sequential contents of the same discovered lint.config.json. Both keep
 * the same builtin-plus-demo producer inputs; neither rewrites product bytes.
 *
 * Two launcher calls remain: fix publishes lint edits and reloads the compiler,
 * while format must omit format diagnostics and exclude every fixed file from
 * writes. Each command owns its actual Program and any production-required
 * cascade reloads; sharing the project does not mean sharing a live Program
 * between commands. Canonical formatter controls execute in
 * TestFormatFixtureCorpus, and external Prettier target-rule comparisons retain
 * their direct Go owner with an independent Node oracle; LSP transport retains
 * its separately named real sidecar connection.
 *
 * @evidence contracts/testing.md#behavioral-verification Real auto-discovered fix publishes six exact builtin, contributor and generic grammar outputs with an unfixed warning and no compiler error; real format then publishes exact semicolons without changing any fixed file. Both commands succeed, original fixture bytes remain immutable and the one temporary consumer is removed.
 * @evidence contracts/testing.md#independent-expectations Copied original authored output files independently specify const cascades, safe and unsafe equality, contributor capitalization and TS/TSX/MTS/CTS generic grammar. The checked-in missing-semicolon source and canonical expected file specify format publication; pre-format observations independently pin format noninterference.
 * @evidence contracts/testing.md#distinguishing-cases Retains reassigned let and unsafe equality negatives, two distinct exported contributor edits, generic unknown/any constraints, multiple parameters, existing commas, defaults, comments and non-arrow declarations. Fix leaves the format source unchanged, then a scoped format phase leaves all six fixed sources unchanged.
 * @evidence contracts/testing.md#execution-ownership The selected esbuild DAG calls this body with one upfront public-lint island; legacy direct selection can still supply its disposable consumer. One fix command covers all six sources and one format command shares that consumer. Every named observation runs after both results; errors aggregate. TestFormatFixtureCorpus directly owns canonical formatting controls; source presence is not execution proof.
 * @evidence contracts/e2e.md#necessary-boundary Package-marker discovery, launcher dispatch, contributor edit transport, actual publication and post-fix compiler reload require this consumer with workspace-linked lint/demo packages and workspace-built launcher. That linked layout is not packed publication or loaded-image certification. Unit-generated edits alone cannot prove these boundaries.
 * @evidence contracts/e2e.md#shared-execution Three former fix projects share one tsconfig, discovered config and fix invocation. Format shares the consumer and immutable builtin-plus-demo producer, while its different command policy requires the second actual invocation; no per-grammar or per-formatter producer is launched.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both phases use one isolated writable island with actual workspace-linked producer paths. After-phase snapshots assert selected and untouched sources. Sync closure metadata is required before another command or restoration; unknown closure retains inputs and blocks shared reuse. Successful direct returns do not certify arbitrary descendant joins. Shared inputs restore after both commands and retain restoration failures; legacy disposable input cleanup remains separate.
 * @evidence contracts/e2e.md#preserved-coverage Original success exits, remaining eqeqeq warning, exact whole-file edits, generic compiler acceptance and absence of format diagnostic banners survive in named checks, alongside every source fixture immutability check. The exact TestFormatFixtureCorpus address owns the fifteen canonical controls and ten historical positives using independently authored bytes. The direct Prettier owner packages/lint/linthost/format_prettier_conformance_e2e_test.go::TestFormatPrettierConformance retains all61 target-rule inputs and pinned independent oracle, now untagged by bd7fef1e5; neither current survival is certified here.
 */
export async function test_lint_write_commands_share_one_consumer(prepared?: {
  root: string;
  cache: string;
  retain(reason: string): void;
}): Promise<void> {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "lint",
    "write-boundary",
  );
  const root =
    prepared?.root ?? LintWorkspace.caseRoot("write-command-matrix", true);
  const sourceFiles = [...FIX_FILES, FORMAT_FILE];
  const originalFiles = [
    "package.json",
    "tsconfig.json",
    "lint.config.json",
    ...sourceFiles.map((file) => `src/${file}`),
    ...sourceFiles.map((file) => `expected/${file}`),
  ];
  const original = new Map(
    originalFiles.map((file) => [
      file,
      fs.readFileSync(path.join(fixture, file), "utf8"),
    ]),
  );
  const expected = new Map(
    sourceFiles.map((file) => [file, original.get(`expected/${file}`)!]),
  );
  const snapshot = () =>
    new Map(
      sourceFiles.map((file) => [
        file,
        fs.readFileSync(path.join(root, "src", file), "utf8"),
      ]),
    );
  const failures: unknown[] = [];
  let returned = true;
  const retain = (reason: string) =>
    prepared === undefined
      ? TestProject.retainTemporaryDirectory(root, reason)
      : prepared.retain(reason);
  try {
    if (prepared === undefined) fs.cpSync(fixture, root, { recursive: true });
    for (const [name, location] of [
      ["@ttsc/lint", ["packages", "lint"]],
      [
        "lint-contributor-demo",
        ["packages", "lint", "test", "lint-contributor-demo"],
      ],
    ] as const) {
      const link = path.join(root, "node_modules", name);
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(
        path.join(TestProject.WORKSPACE_ROOT, ...location),
        link,
        "junction",
      );
    }
    const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
    const env = {
      PATH: fs.existsSync(localGo)
        ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
        : process.env.PATH,
      TTSC_CACHE_DIR: prepared?.cache ?? SHARED_PLUGIN_CACHE_DIR,
      TTSC_GO_BINARY: fs.existsSync(localGo) ? path.join(localGo, "go") : "go",
    };
    const fix = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["fix", "--cwd", root],
      { cwd: root, env },
    );
    if (fix.error || fix.signal !== null || fix.status === null) {
      returned = false;
      retain("public lint fix has no actual process closure acknowledgement");
      throw new Error("public lint fix closure remained unresolved", {
        cause: fix.error,
      });
    }
    const afterFix = snapshot();
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify(
        {
          files: ["src/format/**/*"],
          plugins: { demo: "lint-contributor-demo" },
          format: { semi: true, severity: "error" },
        },
        null,
        2,
      ) + "\n",
    );
    const format = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["format", "--cwd", root],
      { cwd: root, env },
    );
    if (format.error || format.signal !== null || format.status === null) {
      returned = false;
      retain(
        "public lint format has no actual process closure acknowledgement",
      );
      throw new Error("public lint format closure remained unresolved", {
        cause: format.error,
      });
    }
    const afterFormat = snapshot();
    await Scenarios.collect("Lint shared write commands", [
      [
        "fix exit and remaining warning",
        () => {
          assert.equal(fix.status, 0, fix.stderr);
          const diagnostics = stripVTControlCharacters(fix.stderr ?? "");
          assert.match(diagnostics, /warning TS\d+: \[eqeqeq\]/);
          assert.doesNotMatch(diagnostics, /error TS\d+:/);
        },
      ],
      ...FIX_FILES.map(
        (file) =>
          [
            file,
            () => {
              assert.equal(
                afterFix.get(file),
                expected.get(file),
                `fix ${file}`,
              );
              assert.equal(
                afterFormat.get(file),
                afterFix.get(file),
                `format changed ${file}`,
              );
            },
          ] as const,
      ),
      [
        "format-only publication",
        () => {
          assert.notEqual(
            original.get(`src/${FORMAT_FILE}`),
            expected.get(FORMAT_FILE),
          );
          assert.equal(
            afterFix.get(FORMAT_FILE),
            original.get(`src/${FORMAT_FILE}`),
            "fix changed the format-only input",
          );
          assert.equal(format.status, 0, format.stderr);
          assert.doesNotMatch(format.stderr ?? "", /\[format\//);
          assert.equal(afterFormat.get(FORMAT_FILE), expected.get(FORMAT_FILE));
        },
      ],
      ...originalFiles.map(
        (file) =>
          [
            `immutable ${file}`,
            () => {
              assert.equal(
                fs.readFileSync(path.join(fixture, file), "utf8"),
                original.get(file),
              );
            },
          ] as const,
      ),
    ]);
  } catch (error) {
    failures.push(error);
  } finally {
    if (prepared !== undefined && returned)
      for (const file of originalFiles) {
        try {
          fs.writeFileSync(path.join(root, file), original.get(file)!);
        } catch (error) {
          prepared.retain("public lint authored input restoration failed");
          failures.push(error);
        }
      }
    else if (prepared === undefined && returned)
      try {
        fs.rmSync(root, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
        assert.equal(
          fs.existsSync(root),
          false,
          "Write command consumer remained after cleanup",
        );
      } catch (error) {
        failures.push(error);
      }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Lint write command observations or owned cleanup failed",
    );
}

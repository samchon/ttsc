import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  parseDiagnostics,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies package auto-discovery runs complete no-unsafe-assignment semantics
 * without a `compilerOptions.plugins` entry.
 *
 * The issue reproduction crosses every missing direct site and pairs a direct
 * `any` assignment with an `unknown` receiver. Exact diagnostic lines protect
 * both the assignment-site sweep and duplicate suppression.
 *
 * 1. Create a strict NodeNext project that discovers `@ttsc/lint` from
 *    package.json and has no tsconfig plugin entries.
 * 2. Run ttsc on annotated, inferred, destructured, defaulted, class-member,
 *    auto-accessor, and recursive-generic assignments.
 * 3. Require exactly the seven unsafe lines and keep the `unknown` line clean.
 */
export const test_plugin_corpus_auto_discovered_lint_reports_complete_no_unsafe_assignment =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/lint": "*" } }),
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          rootDir: "src",
        },
        files: ["src/main.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({
        rules: { "typescript/no-unsafe-assignment": "error" },
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `declare const leaked: any;

const explicit: string = leaked;
const allowedUnknown: unknown = leaked;
const inferred = leaked;
const [destructured] = leaked;

function withDefault(value = leaked): unknown {
  return value;
}

class Container {
  public value = leaked;
  public accessor accessorValue = leaked;
}

const genericTarget: Set<Set<string>> = new Set<Set<any>>();

export {
  allowedUnknown,
  Container,
  destructured,
  explicit,
  genericTarget,
  inferred,
  withDefault,
};
`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    const diagnostics = parseDiagnostics(
      result.stderr,
      path.join(root, "src", "main.ts"),
    ).filter(
      (diagnostic) => diagnostic.rule === "typescript/no-unsafe-assignment",
    );

    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(
      diagnostics.map((diagnostic) => diagnostic.line),
      [3, 5, 6, 8, 13, 14, 17],
      result.stderr,
    );
  };

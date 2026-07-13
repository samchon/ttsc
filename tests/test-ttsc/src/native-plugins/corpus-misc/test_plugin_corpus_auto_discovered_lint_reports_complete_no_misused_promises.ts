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
 * Verifies package auto-discovery runs complete no-misused-promises defaults
 * without a `compilerOptions.plugins` entry.
 *
 * The issue reproduction crosses callback, predicate, spread, inherited method,
 * and synchronous-disposal contexts while retaining synchronous and
 * Promise-aware controls. Exact lines protect against both omissions and the
 * former method-name false positive.
 *
 * 1. Create a strict NodeNext project that discovers `@ttsc/lint` from
 *    package.json and has no tsconfig plugin entries.
 * 2. Run ttsc across all six invalid default contexts and three controls.
 * 3. Require exactly the six Promise-producing boundaries.
 */
export const test_plugin_corpus_auto_discovered_lint_reports_complete_no_misused_promises =
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
          lib: ["ES2022", "DOM", "ESNext.Disposable"],
        },
        files: ["src/main.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({
        rules: { "typescript/no-misused-promises": "error" },
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `declare function consume(callback: () => void): void;

consume(async () => {
  await Promise.resolve();
});

[1].forEach(() => Promise.resolve());
[1].filter(() => Promise.resolve(true));

const promise = Promise.resolve({ value: 1 });
console.log({ ...promise });

interface SyncContract {
  execute(): void;
}

class AsyncImplementation implements SyncContract {
  public async execute(): Promise<void> {
    await Promise.resolve();
  }
}

function manageResources(): void {
  using asyncThroughSyncProtocol = {
    async [Symbol.dispose](): Promise<void> {
      await Promise.resolve();
    },
  };

  using syncResource = {
    [Symbol.dispose](): void {},
  };

  console.log(asyncThroughSyncProtocol, syncResource);
}

declare const asyncAware: {
  forEach(callback: () => Promise<void>): void;
};

asyncAware.forEach(async () => {
  await Promise.resolve();
});

export { AsyncImplementation, manageResources };
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
      (diagnostic) => diagnostic.rule === "typescript/no-misused-promises",
    );

    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(
      diagnostics.map((diagnostic) => diagnostic.line),
      [3, 7, 8, 11, 18, 24],
      result.stderr,
    );
  };

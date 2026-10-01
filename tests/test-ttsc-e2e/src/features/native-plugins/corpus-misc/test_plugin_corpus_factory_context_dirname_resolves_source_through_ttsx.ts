import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: `context.dirname` locates the plugin source for a
 * descriptor loaded through ttsx, where `__dirname` is undefined.
 *
 * Locks the per-entry `dirname`/`filename` through the ttsx fallback in
 * `loadProjectPlugins.ts::loadDescriptorViaTtsx`, which serializes the factory
 * context into the child process. An ESM `.ts` barrel descriptor runs without
 * `__dirname`/`__filename` — the exact failure mode #248 names — so resolving
 * the Go `source` from `context.dirname` is the only way to find it, and a
 * successful transform proves the field crossed the process boundary intact.
 *
 * 1. A `node_modules/barrel-plugin` ESM `.ts` package whose barrel entry
 *    re-exports a sibling module (forcing the ttsx load path) and whose factory
 *    derives `source` from `context.dirname` and records the context fields.
 * 2. Run ttsc with `--emit` against a project that depends on it.
 * 3. Assert the transform ran (`"CTXDIR:plugin"`) and `filename`/`dirname` name
 *    the resolved descriptor entry, proving they survived ttsx serialization.
 *
 * @evidence contracts/testing.md#behavioral-verification Real native uppercase or prefix output and exact context-file assertions prove the selected descriptor receives its own file and directory identities.
 * @evidence contracts/testing.md#independent-expectations Expected output literals and the independently resolved descriptor filename establish behavior independently of factory serialization.
 * @evidence contracts/testing.md#distinguishing-cases Owns ESM TypeScript barrel via the actual ttsx evaluator; the other evaluator mode remains its separate necessary transport connection.
 * @evidence contracts/testing.md#execution-ownership The matching named native export executes one descriptor consumer through the actual CLI in the shared Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary The actual descriptor evaluator must supply context identities that the factory uses to locate and invoke its native source; pure descriptor guards cannot exercise this connection.
 * @evidence contracts/e2e.md#shared-execution The consumer-relative Go source is a filesystem link to the immutable canonical transformer, so production realpath normalization shares the native binary rather than compiling copied modules.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Descriptor and observation file remain temporary consumer state; only immutable Go source is linked, and source/toolchain/contributor keys govern reuse. No cold build or mutation is asserted.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI success, transformed output and exact context/ambient/physical filename assertions remain; the factory still derives its source from context.dirname.
 */
export function test_plugin_corpus_factory_context_dirname_resolves_source_through_ttsx(): void {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: { "barrel-plugin": "0.1.0" },
      }),
    );
    fs.symlinkSync(
      path.join(workspaceRoot, "packages", "ttsc", "test", "go-transformer"),
      path.join(root, "go-plugin"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const pkg = path.join(root, "node_modules", "barrel-plugin");
    fs.mkdirSync(path.join(pkg, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({
        name: "barrel-plugin",
        version: "0.1.0",
        type: "module",
        main: "./src/index.ts",
        ttsc: {
          plugin: {
            transform: "barrel-plugin",
            name: "prefix",
            prefix: "CTXDIR:",
          },
        },
      }),
    );
    fs.writeFileSync(
      path.join(pkg, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
        include: ["src"],
      }),
    );
    // Barrel entry: the extensionless re-export is the shape Node cannot load,
    // so ttsc hands the entry to ttsx — the load mode where `__dirname` is gone
    // and the factory must lean on `context.dirname` instead.
    fs.writeFileSync(
      path.join(pkg, "src", "runtime.ts"),
      `export const RUNTIME_TAG = "ctxdir-runtime";\n`,
    );
    fs.writeFileSync(
      path.join(pkg, "src", "index.ts"),
      `import fs from "node:fs";
import path from "node:path";

export * from "./runtime";

export default (context: {
  plugin: { name: string };
  dirname: string;
  filename: string;
}) => {
  fs.writeFileSync(
    String(process.env.TTSC_FACTORY_PROBE),
    JSON.stringify({ dirname: context.dirname, filename: context.filename }),
  );
  return {
    name: context.plugin.name,
    source: path.resolve(
      context.dirname,
      "..",
      "..",
      "..",
      "go-plugin",
      "cmd",
      "ttsc-go-transformer",
    ),
  };
};
`,
    );

    const probe = path.join(root, "factory-context-probe.json");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        TTSC_FACTORY_PROBE: probe,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"CTXDIR:plugin"/,
    );

    const recorded = JSON.parse(fs.readFileSync(probe, "utf8")) as {
      dirname: string;
      filename: string;
    };
    // The descriptor entry resolved by ttsc is the package's barrel `index.ts`,
    // and `dirname` is its directory. Both are checked against the expected
    // on-disk paths independently (not just `dirname === path.dirname(filename)`,
    // which the loader satisfies by construction) so a divergence would surface.
    assert.equal(
      recorded.filename,
      fs.realpathSync(path.join(pkg, "src", "index.ts")),
    );
    assert.equal(recorded.dirname, fs.realpathSync(path.join(pkg, "src")));
  }

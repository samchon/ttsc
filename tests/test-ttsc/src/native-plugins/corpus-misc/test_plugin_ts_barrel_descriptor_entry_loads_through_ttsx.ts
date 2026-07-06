import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  copyDirectory,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin resolution: a TypeScript barrel descriptor entry that
 * re-exports sibling modules loads through ttsx.
 *
 * Locks the ttsx fallback in `loadProjectPlugins.ts::loadDescriptorViaTtsx`. A
 * plugin may ship as a `.ts` package whose `transform` entry is a barrel
 * (`export * from "./runtime"` plus the factory) — Node's loader cannot follow
 * the extensionless relative imports, so ttsc runs the entry through `ttsx
 * --no-plugins` (plugins off across the whole graph, so the descriptor's own
 * transform never re-enters and no Go binary is built during the load) and
 * extracts the descriptor it produces.
 *
 * 1. A `node_modules/barrel-plugin` package (`.ts` ESM source with its own
 *    tsconfig) whose `transform` is the barrel `index.ts` re-exporting
 *    `./runtime` and the `./descriptor` factory.
 * 2. Run ttsc with `--emit` against a project that depends on it.
 * 3. Assert zero exit and that the descriptor's transform ran (`"BARREL:plugin"`
 *    in the emit), proving the barrel loaded through ttsx.
 */
export const test_plugin_ts_barrel_descriptor_entry_loads_through_ttsx = () => {
  const root = commonJsProject({
    "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
  });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: { "barrel-plugin": "0.1.0" },
    }),
  );
  copyDirectory(
    path.join(workspaceRoot, "tests", "go-transformer"),
    path.join(root, "go-plugin"),
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
          prefix: "BARREL:",
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
  // Barrel entry: re-exports a sibling runtime and the descriptor factory
  // through extensionless relative imports — the shape Node cannot load and
  // ttsc must hand to ttsx.
  fs.writeFileSync(
    path.join(pkg, "src", "index.ts"),
    `export * from "./runtime";\nexport { default } from "./descriptor";\n`,
  );
  fs.writeFileSync(
    path.join(pkg, "src", "runtime.ts"),
    `export interface Marker {\n  readonly tag: "barrel";\n}\nexport const RUNTIME_TAG = "barrel-runtime";\n`,
  );
  fs.writeFileSync(
    path.join(pkg, "src", "descriptor.ts"),
    `import path from "node:path";

export default (context: { plugin: { name: string }; dirname: string }) => ({
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
});
`,
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /"BARREL:plugin"/);
};

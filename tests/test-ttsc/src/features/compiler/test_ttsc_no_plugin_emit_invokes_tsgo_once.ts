import {
  assert,
  createFakeNativePreview,
  createProject,
  fs,
  path,
  spawnWithoutTsgoOverride,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc no-plugin emit invokes tsgo once.
 *
 * Pins the no-plugin fast path that relies on tsgo's `--noEmitOnError` guard
 * instead of spawning a separate `--noEmit` pre-check before the emit pass. The
 * fake project-local tsgo records every invocation so the assertion is about
 * process count, not wall-clock timing.
 *
 * 1. Install a fake project-local `@typescript/native-preview` binary.
 * 2. Run `ttsc --emit` on a project with no ttsc plugins.
 * 3. Assert one tsgo invocation, the internal `--noEmitOnError` guard, and one
 *    emitted JavaScript file.
 */
export const test_ttsc_no_plugin_emit_invokes_tsgo_once = () => {
  const root = createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value: string = "single-pass";\n`,
  });
  const logFile = path.join(root, "tsgo-invocations.jsonl");
  createFakeNativePreview(
    root,
    `
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(args) + "\\n", "utf8");
if (args.includes("--version")) {
  console.log("Version 7.0.0-dev.FAKE");
  process.exit(0);
}
function flagBoolean(name, fallback) {
  let value = fallback;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== name) continue;
    const next = args[i + 1];
    value = next === "false" ? false : true;
  }
  return value;
}
const projectFlag = args.indexOf("-p");
const tsconfig = projectFlag === -1 ? path.join(process.cwd(), "tsconfig.json") : args[projectFlag + 1];
const projectRoot = path.dirname(tsconfig);
const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
const noEmit = flagBoolean("--noEmit", config.compilerOptions?.noEmit === true);
if (!noEmit) {
  const outDir = path.resolve(projectRoot, config.compilerOptions?.outDir ?? ".");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "main.js"), "exports.value = \\"single-pass\\";\\n", "utf8");
}
process.exit(0);
`,
  );

  const result = spawnWithoutTsgoOverride(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr);
  const invocations = fs
    .readFileSync(logFile, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as string[]);
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0]!.includes("--noEmitOnError"), true);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
};

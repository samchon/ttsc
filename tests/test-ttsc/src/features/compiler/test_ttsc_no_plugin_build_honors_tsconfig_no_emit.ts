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
 * Verifies ttsc no-plugin build honors tsconfig noEmit.
 *
 * Pins the fast path that delegates straight to tsgo when no native plugins are
 * loaded. A project-level `noEmit: true` is already a check-only build, so ttsc
 * must not add emit-only guard flags that send tsgo down its slower emit path.
 *
 * 1. Install a fake project-local `typescript` binary.
 * 2. Run `ttsc` on a project whose tsconfig declares `noEmit: true`.
 * 3. Assert the forwarded tsgo invocation includes `--noEmit`, omits
 *    `--noEmitOnError`, and writes no JavaScript output.
 */
export const test_ttsc_no_plugin_build_honors_tsconfig_no_emit = () => {
  const root = createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        noEmit: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value: string = "no-emit";\n`,
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
  fs.writeFileSync(path.join(outDir, "main.js"), "exports.value = \\"emit\\";\\n", "utf8");
}
process.exit(0);
`,
  );

  const result = spawnWithoutTsgoOverride(ttscBin, ["--cwd", root], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr);
  const invocations = fs
    .readFileSync(logFile, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as string[]);
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0]!.includes("--noEmit"), true);
  assert.equal(invocations[0]!.includes("--noEmitOnError"), false);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
};

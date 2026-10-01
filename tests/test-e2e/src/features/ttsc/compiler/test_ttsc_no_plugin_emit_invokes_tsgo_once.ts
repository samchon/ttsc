import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createFakeNativePreview,
  createProject,
  fs,
  path,
  spawnWithoutTsgoOverride,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsc no-plugin emit invokes tsgo once.
 *
 * Pins the no-plugin fast path that relies on tsgo's `--noEmitOnError` guard
 * instead of spawning a separate `--noEmit` pre-check before the emit pass. The
 * fake project-local tsgo records every invocation so the assertion is about
 * process count, not wall-clock timing.
 *
 * 1. Install a fake project-local `typescript` binary.
 * 2. Run `ttsc --emit` on a project with no ttsc plugins.
 * 3. Assert one tsgo invocation, the internal `--noEmitOnError` guard, and one
 *    emitted JavaScript file.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --emit against a scripted consumer-local compiler and requires exactly one logged invocation, --noEmitOnError and an actual dist/main.js artifact.
 * @evidence contracts/testing.md#independent-expectations The authored peer appends one argv record per process call and writes a controlled output only when noEmit is false; the literal count independently detects a duplicate check-plus-emit call.
 * @evidence contracts/testing.md#distinguishing-cases This explicit emit case complements configured noEmit, distinguishing the guarded one-pass emit policy from double compiler execution.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the named process feature; the launcher calls an actual scripted consumer-local compiler rather than building a native contributor.
 * @evidence contracts/e2e.md#necessary-boundary Real consumer executable discovery and argv transport must reach the scripted peer once; this fixture proves invocation count and host policy, not native JavaScript correctness.
 * @evidence contracts/e2e.md#shared-execution One launcher lifetime must create one peer record and one artifact, reusing built package preparation. The peer is separately authored per case, with no installation/build side effects.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private registered consumer/log/output start empty, and spawnWithoutTsgoOverride selects its preview binary. Synchronous process completion precedes count and file checks; suite cleanup releases fixture state.
 * @evidence contracts/e2e.md#preserved-coverage Original status, exact call count, guarded-emit flag and output existence remain. Canned output content is not used to claim compiler semantics.
 */
export const test_ttsc_no_plugin_emit_invokes_tsgo_once = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_no_plugin_emit_invokes_tsgo_once/inputs-1"));
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

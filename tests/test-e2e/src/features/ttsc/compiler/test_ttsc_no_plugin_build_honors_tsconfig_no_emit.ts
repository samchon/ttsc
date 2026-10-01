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
 *
 * @evidence contracts/testing.md#behavioral-verification Runs no-plugin build against a scripted consumer-local compiler, requiring one invocation containing --noEmit but no --noEmitOnError and no dist/main.js.
 * @evidence contracts/testing.md#independent-expectations The fixture config declares noEmit:true and the independent compiler peer logs argv and conditionally writes output; this oracle proves host invocation policy, not real tsgo semantics.
 * @evidence contracts/testing.md#distinguishing-cases Configured noEmit without explicit --emit distinguishes inherited no-publication from the emit-enabled companion case and detects an extra preliminary compiler call.
 * @evidence contracts/testing.md#execution-ownership The matching compiler feature executes the real launcher with an actual scripted external compiler process; it remains a process boundary rather than a pure unit.
 * @evidence contracts/e2e.md#necessary-boundary Consumer-local executable discovery and launcher argv delivery must connect to the peer and filesystem observation; the programmed producer cannot certify actual native emit behavior.
 * @evidence contracts/e2e.md#shared-execution One launcher lifetime produces exactly one logged compiler call. Package build is shared and no Go contributor is built; the companion peer setup is a remaining shared-fixture consolidation opportunity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered consumer owns its preview package, log and absent dist; spawnWithoutTsgoOverride prevents workspace compiler substitution and synchronous completion precedes log reads.
 * @evidence contracts/e2e.md#preserved-coverage All original invocation count, noEmit/noEmitOnError flag and absent-output checks remain. Real TypeScript noEmit behavior is covered by native compiler corpus entries.
 */
export const test_ttsc_no_plugin_build_honors_tsconfig_no_emit = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_no_plugin_build_honors_tsconfig_no_emit/inputs-1"));
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

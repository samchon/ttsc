import { FixtureFiles } from "../../../internal/FixtureFiles";
import { isolatedCacheEnvironment } from "../../../internal/ttsc/internal/isolated-cache-environment";
import {
  assert,
  createFakeNativePreview,
  createProject,
  fs,
  path,
  spawnWithoutTsgoOverride,
  ttscBin,
  ttsxBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies the launcher's contract with a consumer-local native compiler on one
 * scripted installation.
 *
 * A project-local `typescript` install replaces the workspace compiler with a
 * scripted stub that logs every argument vector and writes JavaScript itself.
 * One project and one stub serve four requests whose subject is how ttsc and
 * ttsx invoke the compiler, not what TypeScript means: a no-plugin build of a
 * `noEmit` project, a no-plugin emit that must use exactly one invocation, a
 * ttsx run that must execute the stub's output, and (on POSIX) a version
 * banner from a compiler binary whose executable bits were removed.
 *
 * 1. Install the stub; configure `noEmit: true`; run `ttsc` and read the log.
 * 2. Configure emission; run `ttsc --emit` and read the reset log.
 * 3. Run `ttsx src/index.ts` and require the stub's output, not the source.
 * 4. On POSIX remove the stub's executable bits and run `ttsc --version`.
 *
 * @evidence contracts/testing.md#behavioral-verification Four real launcher requests against one scripted compiler require exactly one invocation with --noEmit and no --noEmitOnError and no output for a noEmit project; exactly one invocation with --noEmitOnError and dist/main.js for an emit; ttsx output consumer-local-tsgo with --outDir, --showConfig and --listFilesOnly true in the log; and on POSIX the NONEXEC banner with repaired executable bits.
 * @evidence contracts/testing.md#independent-expectations Argument literals defined by the launcher protocol and authored stub output strings (single-pass, consumer-local-tsgo, NONEXEC) are the oracles; the source prints source-should-not-run so executing the original source cannot satisfy the ttsx request.
 * @evidence contracts/testing.md#distinguishing-cases The noEmit and emitting configurations differ only in the compiler option, so the same stub distinguishes the guard flag from its absence; the ttsx request distinguishes stub output from source output; the version request distinguishes a repaired from an unrepaired binary.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns all four requests and their log assertions; the log is reset between requests so each count belongs to one launcher invocation. Failures are collected under per-request labels.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher argv delivery to an executable compiler, its exit and output handling, and POSIX executable-bit repair exist only across a real process boundary; a unit over argument arrays cannot observe invocation counts or mode repair.
 * @evidence contracts/e2e.md#shared-execution One project, one scripted installation and one stub launcher binary serve all four requests; each request needs its own launcher process by definition.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The invocation log and the configuration are reset before each request; the version request runs last because it removes executable bits; the isolated cache environment keeps ttsx state inside the project.
 * @evidence contracts/e2e.md#preserved-coverage Replaces the former separate entries for no-plugin noEmit build, no-plugin single-invocation emit, ttsx consumer-local compiler execution and the POSIX non-executable version banner, keeping every status, count, flag, output and mode assertion. The version request keeps its POSIX-only scope by skipping inside the entry on Windows.
 */
export function test_compiler_consumer_local_native_compiler_receives_the_launcher_contract(): void {
  const root = createProject(
    FixtureFiles.read("ttsc/compiler/consumer-fake"),
  );
  const logFile = path.join(root, "tsgo-invocations.jsonl");
  const writeConfig = (compilerOptions: Record<string, unknown>): void =>
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          outDir: "dist",
          rootDir: ".",
          ...compilerOptions,
        },
        include: ["src"],
      }),
    );
  const invocations = (): string[][] =>
    fs.existsSync(logFile)
      ? fs
          .readFileSync(logFile, "utf8")
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line) as string[])
      : [];
  const reset = (): void => {
    fs.rmSync(logFile, { force: true });
    fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
  };
  createFakeNativePreview(
    root,
    `
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(args) + "\\n", "utf8");
if (args.includes("--version")) {
  console.log("Version 7.0.0-dev.NONEXEC");
  process.exit(0);
}
const source = ${JSON.stringify(path.join(root, "src", "index.ts"))};
function flagBoolean(name, fallback) {
  let value = fallback;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== name) continue;
    value = args[i + 1] === "false" ? false : true;
  }
  return value;
}
const outDirAt = args.indexOf("--outDir");
if (args.includes("--showConfig")) {
  console.log(JSON.stringify({
    compilerOptions: {
      target: "es2022", module: "commonjs", rootDir: ".",
      outDir: outDirAt >= 0 ? args[outDirAt + 1] : "dist",
    },
    files: [source],
  }));
  process.exit(0);
}
if (args.includes("--listFilesOnly")) {
  console.log(source);
  process.exit(0);
}
const projectFlag = args.indexOf("-p");
const tsconfig = projectFlag === -1 ? path.join(process.cwd(), "tsconfig.json") : args[projectFlag + 1];
const projectRoot = path.dirname(tsconfig);
const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
const noEmit = flagBoolean("--noEmit", config.compilerOptions?.noEmit === true);
if (!noEmit) {
  const outDir = outDirAt >= 0
    ? args[outDirAt + 1]
    : path.resolve(projectRoot, config.compilerOptions?.outDir ?? ".");
  if (outDirAt < 0) {
    const main = path.join(outDir, "main.js");
    fs.mkdirSync(path.dirname(main), { recursive: true });
    fs.writeFileSync(main, "exports.value = \\"single-pass\\";\\n", "utf8");
  } else {
    // A runtime request names its own outDir and owns exactly the entry it
    // lists, so the stub emits only that source there.
    const index = path.join(outDir, "src", "index.js");
    fs.mkdirSync(path.dirname(index), { recursive: true });
    fs.writeFileSync(index, "console.log(\\"consumer-local-tsgo\\");\\n", "utf8");
  }
  if (args.includes("--listFiles")) console.log(source);
  if (args.includes("--listEmittedFiles")) console.log("TSFILE: " + path.join(outDir, outDirAt < 0 ? "main.js" : "src/index.js"));
}
`,
  );
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  writeConfig({ noEmit: true });
  reset();
  const noEmitBuild = spawnWithoutTsgoOverride(ttscBin, ["--cwd", root], {
    cwd: root,
  });
  check("no-plugin build honors tsconfig noEmit", () => {
    assert.equal(noEmitBuild.status, 0, noEmitBuild.stderr);
    const log = invocations();
    assert.equal(log.length, 1);
    assert.equal(log[0]!.includes("--noEmit"), true);
    assert.equal(log[0]!.includes("--noEmitOnError"), false);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  });

  writeConfig({});
  reset();
  const emit = spawnWithoutTsgoOverride(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
  });
  check("no-plugin emit invokes the compiler once", () => {
    assert.equal(emit.status, 0, emit.stderr);
    const log = invocations();
    assert.equal(log.length, 1);
    assert.equal(log[0]!.includes("--noEmitOnError"), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
  });

  reset();
  const ttsx = spawnWithoutTsgoOverride(ttsxBin, ["src/index.ts"], {
    cwd: root,
    env: isolatedCacheEnvironment(root),
  });
  check("ttsx executes JavaScript emitted by the consumer-local compiler", () => {
    assert.equal(ttsx.status, 0, ttsx.stderr);
    assert.equal(ttsx.stdout.trim(), "consumer-local-tsgo");
    const text = invocations().map((args) => args.join(" ")).join("\n");
    assert.match(text, /--outDir/);
    assert.match(text, /--showConfig/);
    assert.match(text, /--listFilesOnly true/);
  });

  if (process.platform !== "win32") {
    const tsgo = path.join(
      root,
      "node_modules",
      "@typescript",
      `typescript-${process.platform}-${process.arch}`,
      "lib",
      "tsc",
    );
    fs.chmodSync(tsgo, 0o644);
    const version = spawnWithoutTsgoOverride(ttscBin, ["--version"], {
      cwd: root,
    });
    check("version makes the consumer compiler executable before spawn", () => {
      assert.equal(version.status, 0, version.stderr);
      assert.match(version.stdout, /^ttsc /);
      assert.match(version.stdout, /Version 7\.0\.0-dev\.NONEXEC/);
      assert.notEqual(fs.statSync(tsgo).mode & 0o111, 0);
    });
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "consumer-local compiler contract failed",
    );
}

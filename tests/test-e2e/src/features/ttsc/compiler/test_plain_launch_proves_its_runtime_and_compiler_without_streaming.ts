import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  os,
  path,
  spawn,
  ttscBin,
  ttsxBin,
} from "../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies a launch without plugins neither streams nor probes a runtime it
 * does not need, and a repeated `ttsx` run proves its runtime and compiler from
 * records.
 *
 * WARNING (#1726): every `ttsc` build selected `TTSC_NODE_BINARY` for a
 * TypeScript-Go spawn that never reads it, streaming the 85 MB Node executable
 * twice and probing it, about 0.2 s of a 0.5 s build. Every `ttsx` process also
 * streamed the 24.5 MB compiler executable to key its runtime builds. If this
 * case fails, a launch is paying for unchanged executables again.
 *
 * 1. Build the copied project without plugins under a private trace: no runtime
 *    identity is observed, no capability probe runs, and no plugin cache
 *    directory appears.
 * 2. Run an entry through `ttsx` twice; the second run starts no capability probe
 *    and streams only executables on a device the launch mints no clock
 *    reference on.
 *
 * @evidence contracts/testing.md#behavioral-verification Real `ttsc` and `ttsx` launches run over a copied project; their traces' identity and probe observations, their status and output, and the project tree are the asserted behavior.
 * @evidence contracts/testing.md#independent-expectations The compiler spawn reads no Node selection by contract, so no identity or probe is expected at all; a repeated `ttsx` run's executables are proven from records unless their device holds no reference, which the test derives from the executables' own devices.
 * @evidence contracts/testing.md#distinguishing-cases Owns the launch without plugins: the compiler-only build against the runtime launch, and the first `ttsx` run that records against the second that reuses. Plugin loads own their budget in the warm-load corpus case.
 * @evidence contracts/testing.md#execution-ownership The runtime batch invokes this named scenario; its body owns the three launches and reads the traces it requested.
 * @evidence contracts/e2e.md#necessary-boundary Whether a new process streams an executable exists only across real launches.
 * @evidence contracts/e2e.md#shared-execution No native plugin is built; the project and its caches are private to this case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The copied project, its runtime cache and the private trace directories belong to this case; `NODE_OPTIONS` is emptied so runtime records are eligible. Each launch finishes before the next starts.
 * @evidence contracts/e2e.md#preserved-coverage New coverage; no existing assertion moved here.
 */
export function test_plain_launch_proves_its_runtime_and_compiler_without_streaming(): void {
  const root = copyProject("plain-launch");
  const env = { NODE_OPTIONS: "", TTSC_CACHE_DIR: "" };
  const sink = process.env.TTSC_E2E_TRACE;
  const launch = (bin: string, args: string[], label: string) => {
    const trace = TestProject.tmpdir(
      `ttsc-plain-${label}-`,
      sink !== undefined && path.isAbsolute(sink) ? sink : undefined,
    );
    const result = spawn(bin, args, {
      cwd: root,
      env: { ...env, TTSC_E2E_TRACE: trace },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    return { result, events: readTrace(trace) };
  };
  const phases = (events: ITraceEvent[]) =>
    events
      .filter((event) => event.event === "capability-resolution")
      .map((event) => event.data ?? {});
  const probes = (events: ITraceEvent[]) =>
    events.filter(
      (event) =>
        event.event === "process-attempt" &&
        event.data?.origin === "runtime-capability-probe",
    ).length;

  const build = launch(ttscBin, ["--cwd", root], "build");
  assert.deepEqual(
    phases(build.events).filter(
      (data) => data.phase === "runtime-executable-identity-observed",
    ),
    [],
    "a compiler-only build streams no runtime",
  );
  assert.equal(
    probes(build.events),
    0,
    "a compiler-only build probes no runtime",
  );
  assert.equal(
    fs.existsSync(path.join(root, "node_modules", ".cache", "ttsc")),
    false,
    "a build without plugins creates no plugin cache",
  );

  const entry = path.join("src", "main.ts");
  const first = launch(ttsxBin, [entry], "first");
  assert.match(first.result.stdout, /plain-launch 42/);
  const second = launch(ttsxBin, [entry], "second");
  assert.match(second.result.stdout, /plain-launch 42/);
  assert.equal(
    probes(second.events),
    0,
    "a repeated run reuses the probe answer",
  );
  const referenced = new Set([
    fs.statSync(os.tmpdir()).dev,
    fs.statSync(root).dev,
  ]);
  assert.deepEqual(
    phases(second.events)
      .filter((data) => data.phase === "runtime-executable-identity-observed")
      .map((data) => String(data.physicalPath))
      .filter((file) => referenced.has(fs.statSync(file).dev)),
    [],
    "a repeated run streams no executable on a referenced device",
  );
}

interface ITraceEvent {
  event: string;
  data?: Record<string, unknown>;
}

function readTrace(directory: string): ITraceEvent[] {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(directory, name), "utf8")
        .split("\n")
        .filter((line) => line.length !== 0)
        .map((line) => JSON.parse(line) as ITraceEvent),
    );
}

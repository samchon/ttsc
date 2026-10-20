import assert from "node:assert/strict";
import childProcess from "node:child_process";
import path from "node:path";

/**
 * Verifies the installed `@ttsc/graph` graphs each project with the producer of
 * its own TypeScript line.
 *
 * `ttscgraph` links the compiler, so the graph platform package carries one
 * producer per compiler target: `ttscgraph` against TypeScript 7.0 and
 * `ttscgraph-7.1` against TypeScript 7.1 (samchon/ttsc#1803). The graph client
 * picks the one of the graphed project's line. The source unit owns that pick
 * over inert files; this case runs the packed producers.
 *
 * 1. Run each packed producer's `--version` and require the compiler it names.
 * 2. Dump a TypeScript 7.0.2 project and a 7.1 nightly project with the installed
 *    `ttsc-graph` launcher.
 * 3. Require each dump's producer to record its project's compiler.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs both packed producers' --version and the installed launcher's dump for both projects; the printed compiler and each dump's provenance.producer.typescript are the observed results.
 * @evidence contracts/testing.md#independent-expectations The 7.0 producer must name 7.0.2, the consumer's installed TypeScript, and the 7.1 producer 7.1.0-dev, the version its pinned compiler declares; both are literals.
 * @evidence contracts/testing.md#distinguishing-cases The two projects differ only by their installed TypeScript line, so one producer graphing both would record one compiler twice.
 * @evidence contracts/testing.md#execution-ownership test_e2e_installation supplies the packed graph installation and the projects of the compiler-target case; this case starts two producer version processes and two launcher dumps.
 * @evidence contracts/e2e.md#necessary-boundary The packed platform package's producers and the installed client's selection meet only in an installation; the source unit resolves inert files.
 * @evidence contracts/e2e.md#shared-execution Reuses the consumer and both projects of the compiler-target case instead of installing TypeScript again.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Dumps write to stdout only and leave the projects as the compiler-target case left them.
 * @evidence contracts/e2e.md#preserved-coverage A new boundary; no existing assertion moves or is removed.
 */
export function case_installed_graph_runs_the_producer_of_each_typescript_line(input: {
  /** The installed `@ttsc/graph` package directory. */
  graph: string;

  /** The installed `@ttsc/graph-<platform>-<arch>` package directory. */
  graphPlatform: string;

  /** The projects of each TypeScript line. */
  projects: { readonly "7.0": string; readonly "7.1": string };
}): void {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const expected = { "7.0": "7.0.2", "7.1": "7.1.0-dev" } as const;
  for (const [line, producer] of [
    ["7.0", "ttscgraph"],
    ["7.1", "ttscgraph-7.1"],
  ] as const) {
    const version = childProcess.spawnSync(
      path.join(input.graphPlatform, "bin", producer + suffix),
      ["--version"],
      { encoding: "utf8" },
    );
    assert.equal(
      version.status,
      0,
      `${producer} --version:\n${version.stderr}`,
    );
    assert.match(
      version.stdout,
      new RegExp(`\\btypescript ${expected[line].replace(/\./g, "\\.")},`),
      `${producer} must link the TypeScript ${line} compiler`,
    );
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.TTSC_GRAPH_BINARY;
  delete env.TTSC_TSGO_BINARY;
  for (const line of ["7.0", "7.1"] as const) {
    const dump = childProcess.spawnSync(
      process.execPath,
      [
        path.join(input.graph, "lib", "bin.js"),
        "dump",
        "--cwd",
        input.projects[line],
      ],
      { encoding: "utf8", env, maxBuffer: 1 << 28 },
    );
    assert.equal(
      dump.status,
      0,
      `ttsc-graph dump in the ${line} project:\n${dump.stderr}`,
    );
    const producer = (
      JSON.parse(dump.stdout) as {
        provenance: { producer: { tool: string; typescript: string } };
      }
    ).provenance.producer;
    assert.equal(producer.tool, "ttscgraph");
    assert.equal(producer.typescript, expected[line]);
  }
}

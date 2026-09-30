const cp = require("node:child_process");
const path = require("node:path");
const { runIndependent } = require("./run-independent.cjs");

/**
 * Check production and both authored test populations without early bailout.
 *
 * A failing production or test claim must leave the other populations observable.
 * This is the root command used by the existing build job, not another CI job.
 *
 * @evidence contracts/common.md#principled-implementation Each scope invokes the actual Evidence checker with its owning configuration; the root result fails if any scope fails and independent scopes still finish after diagnostics or a spawn error.
 * @evidence contracts/common.md#clear-and-simple-design One ordered three-scope command retains the recursive production check and adds the unit and E2E configurations without changing their selectors or duplicating their policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Checker exit statuses and inherited diagnostics remain authoritative; no severity override, exclusion, retry or successful fallback masks an incomplete analysis.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies independent failure collection and existing-job ownership; each scope name appears in start and completion messages so a blocked or failed scope remains distinguishable.
 * @evidence contracts/performance.md#efficient-algorithms The fixed three scopes execute once in order; the checker owns source analysis, and this adapter retains only the bounded scope and failure lists.
 * @evidence contracts/performance.md#reuse-equivalent-work Each configured population has one checker invocation; the existing build job owns this single root command rather than separate workflow or test-runner checks. No checker result is cached across source changes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources At most one checker child runs and each is joined before the next scope; inherited output is streamed, process spawn failures settle as failures, and no child or result is retained after completion.
 * @evidence contracts/portability.md#os-neutral-implementation The executable is pnpm with literal repository-owned arguments; Windows uses the shell to launch its command shim while POSIX launches directly, and every scope shares the resolved repository cwd.
 */
async function runEvidence() {
  const root = path.resolve(__dirname, "../..");
  const scopes = [
    {
      name: "production",
      args: ["--filter", "./packages/*", "-r", "--no-bail", "--workspace-concurrency=1", "run", "evidence"],
    },
    { name: "unit", args: ["exec", "evidence", "--config", "tests/unit/evidence.config.json"] },
    { name: "e2e", args: ["exec", "evidence", "--config", "tests/e2e/evidence.config.json"] },
  ];
  const failures = await runIndependent(scopes, (scope) => new Promise((resolve) => {
    console.log(`Evidence ${scope.name}: start`);
    const child = cp.spawn("pnpm", scope.args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      shell: process.platform === "win32",
    });
    child.on("error", (error) => {
      console.error(`Evidence ${scope.name}: spawn failed`, error);
      resolve(1);
    });
    child.on("close", (code, signal) => {
      console.log(`Evidence ${scope.name}: finished (exit ${code}, signal ${signal})`);
      resolve(code ?? 1);
    });
  }));
  if (failures.length) console.error(`Evidence failed: ${failures.map((scope) => scope.name).join(", ")}`);
  return failures.length ? 1 : 0;
}

runEvidence().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

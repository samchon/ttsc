const cp = require("node:child_process");
const path = require("node:path");
const { runIndependent } = require("./run-independent.cjs");

/**
 * Check production and both authored test populations without early bailout.
 *
 * A failing production or test claim must leave the other populations observable.
 * This is the root command used by the existing build job, not another CI job.
 *
 * Each scope invokes the actual checker with its owning configuration. The
 * ordered production, unit and E2E checks preserve their selectors and finish
 * independently after diagnostics or spawn errors. Any failure fails the root
 * result; inherited diagnostics and exit statuses remain authoritative, with no
 * severity override, exclusion, retry or successful fallback. Named start and
 * completion messages distinguish every scope's outcome.
 *
 * Each configured population runs once, with no result cached across source
 * changes. The checker owns source analysis; this adapter retains only three
 * scope entries and their failures. At most one child runs, and it is joined
 * before the next scope. Output is streamed and spawn failures settle as failures.
 *
 * Windows launches pnpm through the shell for its command shim; POSIX launches
 * it directly. Arguments are literal repository-owned tokens and every scope
 * uses the resolved repository cwd.
 *
 * This private, automatically invoked script helper is reviewed through the
 * root command; it is not an eligible public JavaScript Evidence host.
 */
async function runEvidence() {
  const root = path.resolve(__dirname, "../..");
  const scopes = [
    {
      name: "production",
      args: ["--filter", "./packages/*", "-r", "--no-bail", "--workspace-concurrency=1", "run", "evidence"],
    },
    { name: "unit", args: ["exec", "evidence", "--config", "tests/test-scripts/evidence.config.json"] },
    { name: "e2e", args: ["exec", "evidence", "--config", "tests/test-scripts-e2e/evidence.config.json"] },
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

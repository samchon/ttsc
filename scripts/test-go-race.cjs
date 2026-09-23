// Run the LSP proxy's Go packages under the race detector.
//
// The proxy (`packages/ttsc/internal/lspserver`) runs an editor pump, an
// upstream pump, a goroutine per diagnostics publication, a debounce timer, and
// asynchronous code-action and command responses, and its writers decide under
// one lock and write under another. Its tests prove the behavior; only the race
// detector proves the memory accesses behind it. Two steps:
//
// 1. Every test of the proxy package and of the driver tests that drive it,
//    once, under `-race`.
// 2. The acceptance of samchon/ttsc#1441: the did-save tests 200 times in a row
//    under `-race` with one scheduler thread, which serializes goroutines and
//    so reaches interleavings a parallel run rarely takes.
//
// `-race` needs cgo, so this runs where a C toolchain exists, which is the Linux
// CI lane (`go-race`). Each step reports how long it took, which is what the
// lane's cost is judged by.

const cp = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cwd = path.join(root, "packages", "ttsc");

const steps = [
  {
    name: "proxy and driver tests under -race",
    args: ["test", "-race", "-count=1", "./internal/lspserver/", "./test/driver/"],
    env: {},
  },
  {
    name: "#1441 acceptance: did-save tests, 200 runs, -race, GOMAXPROCS=1",
    args: [
      "test",
      "-race",
      "-count=200",
      "-run",
      "TestLSPProxyDidSave|TestLSPProxyForwardsDidSave",
      "./test/driver/",
    ],
    env: { GOMAXPROCS: "1" },
  },
];

let failed = 0;
for (const step of steps) {
  const started = process.hrtime.bigint();
  const result = cp.spawnSync("go", step.args, {
    cwd,
    env: { ...process.env, CGO_ENABLED: "1", ...step.env },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const status = result.status ?? 1;
  console.log(
    `go-race: ${step.name}: ${status === 0 ? "passed" : "FAILED"} in ${seconds.toFixed(1)} s`,
  );
  if (status !== 0) failed += 1;
}
process.exit(failed === 0 ? 0 : 1);

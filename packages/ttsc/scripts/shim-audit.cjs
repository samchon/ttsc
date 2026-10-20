// Run the shim completeness audit for every compiler target, forwarding the
// mode flags (-check by default, or -fix / -write-baseline) to each run. The
// 7.1 bridges are standalone modules outside the repository workspace.
const { spawnSync } = require("node:child_process");

const targets = [
  {
    name: "TypeScript 7.0",
    args: [
      "-anchor",
      "../../shim/ast",
      "-shim",
      "../../shim",
      "-neutral-with",
      "../../targets/7.1/bridge",
    ],
    env: {},
  },
  {
    name: "TypeScript 7.1",
    args: [
      "-anchor",
      "../../targets/7.1/bridge/ast",
      "-shim",
      "../../targets/7.1/bridge",
      "-internal",
      "github.com/microsoft/TypeScript/tsc/internal/",
      "-baseline",
      "baseline-7.1.json",
    ],
    env: { GOWORK: "off" },
  },
];

const mode = process.argv.slice(2);
let status = 0;
for (const target of targets) {
  console.log(`shim_audit: ${target.name}`);
  const result = spawnSync(
    "go",
    [
      "-C",
      "tools/shim_audit",
      "run",
      "-mod=readonly",
      ".",
      ...(mode.length === 0 ? ["-check"] : mode),
      ...target.args,
    ],
    {
      cwd: `${__dirname}/..`,
      env: { ...process.env, ...target.env },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) status = result.status ?? 1;
}
process.exit(status);

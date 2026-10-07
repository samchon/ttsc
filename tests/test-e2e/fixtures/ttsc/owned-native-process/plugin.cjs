const fs = require("node:fs");
const path = require("node:path");

if (
  process.env.TTSC_OWNED_HELPER_ADMISSIONS &&
  process.argv[1] &&
  path.basename(process.argv[1]) === "__source-process"
) {
  const result = process.argv.indexOf("--result");
  if (result < 0 || !process.argv[result + 1])
    throw new Error("Authored helper observer requires the actual result argv");
  fs.appendFileSync(
    process.env.TTSC_OWNED_HELPER_ADMISSIONS,
    JSON.stringify({ pid: process.pid, resultFile: process.argv[result + 1] }) +
      "\n",
  );
}

if (
  process.env.TTSC_OWNED_PROBE_PID &&
  require("node:worker_threads").isMainThread &&
  process.argv[1] === undefined
) {
  fs.writeFileSync(process.env.TTSC_OWNED_PROBE_PID, String(process.pid));
  setInterval(() => {}, 1000);
}

module.exports = () => {
  const source = process.env.TTSC_OWNED_PLUGIN_SOURCE;
  if (!source || !fs.statSync(source).isDirectory())
    throw new Error("Authored plugin requires its actual utility-host source");
  return { name: "owned-native-probe", source, stage: "transform" };
};

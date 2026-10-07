const fs = require("node:fs");
const cp = require("node:child_process");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TTSC_GO_ARGV_CAPTURE, JSON.stringify({
  args,
  sentinel: process.env.TTSC_GO_CALLER_SENTINEL,
}) + "\n", "utf8");
// Only the actual metadata query delegates to Go. Arbitrary argv transcripts
// (including a mod/edit prefix plus shell metacharacters) exercise transport,
// and are not valid Go commands merely because they contain -json.
if (args.length === 3 && args[0] === "mod" && args[1] === "edit" && args[2] === "-json") {
  const result = cp.spawnSync(process.env.TTSC_GO_METADATA_BINARY, args, {
    stdio: "inherit", windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.signal !== null || result.status === null) {
    throw new Error("owned Go metadata command did not exit normally: " + result.signal);
  }
  process.exitCode = result.status;
}

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Write a generated `go.work` and let the Go tool set its `go` directive.
 *
 * A fixed directive is wrong for some module it lists: a module may declare a
 * patch release such as `go 1.26.0`, which Go treats as newer than a `go 1.26`
 * workspace and refuses to build. `go work use` with no arguments raises the
 * directive to what every listed module requires, and reports Go's own
 * toolchain error for a module the selected toolchain is too old for.
 *
 * @param {string} location Absolute path of the `go.work` to write.
 * @param {string} body The `use` and `replace` blocks, without a `go` line.
 * @param {NodeJS.ProcessEnv} env Environment of the Go commands that will use
 *   the workspace, so the directive is set by the same toolchain.
 */
function writeGoWork(location, body, env) {
  fs.writeFileSync(location, body, "utf8");
  const result = cp.spawnSync("go", ["work", "use"], {
    cwd: path.dirname(location),
    encoding: "utf8",
    env: { ...env, GOWORK: location },
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `go work use failed for ${location}:\n${result.stderr || result.stdout}`,
    );
  }
}

module.exports = { writeGoWork };

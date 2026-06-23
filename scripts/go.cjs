const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const [command, ...rest] = process.argv.slice(2);

if (!command) {
  throw new Error("go helper requires a command");
}

// The MCP server's embedded `instructions` are injected verbatim into every
// agent's context. Codex reliably reads only the first ~512 characters of that
// field (developers.openai.com/codex/mcp), and an over-long, low-signal block
// conflicts with the user's own prompt and erodes the savings the graph buys.
const INSTRUCTIONS_BUDGET = 512;

if (command === "build-native") {
  checkInstructionsBudget();
  fs.mkdirSync("native", { recursive: true });
  runGo([
    "build",
    "-o",
    path.join("native", process.platform === "win32" ? "ttsc-native.exe" : "ttsc-native"),
    "./cmd/platform",
  ]);
} else {
  runGo([command, ...rest]);
}

// Fail the native build before the bytes ever ship if the budget is blown.
function checkInstructionsBudget() {
  const file = path.join("internal", "graph", "mcp", "instructions.md");
  if (!fs.existsSync(file)) {
    return;
  }
  const chars = [...fs.readFileSync(file, "utf8").trimEnd()].length;
  if (chars > INSTRUCTIONS_BUDGET) {
    throw new Error(
      `${file} is ${chars} characters, over the ${INSTRUCTIONS_BUDGET}-char MCP-instructions budget. ` +
        `Codex only reads the first ~512 chars and the rest fights the user's prompt — trim it.`,
    );
  }
}

function runGo(args) {
  const result = cp.spawnSync("go", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: goPath(),
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

function goPath() {
  const home = os.homedir();
  const localGo = path.join(home, "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

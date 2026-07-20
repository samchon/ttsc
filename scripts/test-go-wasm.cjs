// Run the js/wasm host tests through the Go toolchain's Node.js wrapper.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttscDir = path.join(root, "packages", "ttsc");
const wasmDir = path.join(root, "packages", "wasm");
const wasmExecRunner = path.join(__dirname, "go-wasm-exec.cjs");
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-wasm-go-work-"));

try {
  const goWork = path.join(workdir, "go.work");
  writeGoWork(goWork);
  const goroot = cp.execFileSync("go", ["env", "GOROOT"], {
    encoding: "utf8",
  }).trim();
  const wasmExec = path.join(goroot, "lib", "wasm", "wasm_exec_node.js");
  const result = cp.spawnSync(
    "go",
    [
      "test",
      "-count=1",
      "-exec",
      `node \"${wasmExecRunner}\" \"${wasmExec}\"`,
      "./test/host",
    ],
    {
      cwd: wasmDir,
      env: {
        ...process.env,
        GOOS: "js",
        GOARCH: "wasm",
        GOWORK: goWork,
        PATH: fs.existsSync(goRoot)
          ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
          : process.env.PATH,
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  fs.rmSync(workdir, { recursive: true, force: true });
}

function writeGoWork(location) {
  const useDirs = [wasmDir, ttscDir];
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);
  fs.writeFileSync(
    location,
    [
      "go 1.26",
      "",
      "use (",
      useDirs.map((dir) => `\t${dir}`).join("\n"),
      ")",
      "",
      `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${ttscDir}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

function walkForGoMod(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name === "go.mod")) {
    out.push(dir);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name === ".cache") continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}

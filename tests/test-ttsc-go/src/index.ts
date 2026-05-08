import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const ttscRoot = path.join(workspaceRoot, "packages", "ttsc");
const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");

const result = child_process.spawnSync("go", ["test", "./..."], {
  cwd: ttscRoot,
  env: {
    ...process.env,
    PATH: fs.existsSync(localGo)
      ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH,
  },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

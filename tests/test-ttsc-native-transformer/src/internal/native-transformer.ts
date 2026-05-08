import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  copyProject,
  runNode,
  spawn,
  ttscBin,
  workspaceRoot,
} from "@ttsc/testing";

function goTransformerSource() {
  return path.join(
    workspaceRoot,
    "tests",
    "go-transformer",
    "cmd",
    "ttsc-go-transformer",
  );
}

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

export {
  assert,
  copyProject,
  fs,
  goPath,
  goTransformerSource,
  os,
  path,
  runNode,
  spawn,
  ttscBin,
  workspaceRoot,
};

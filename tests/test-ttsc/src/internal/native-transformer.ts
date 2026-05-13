import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TTSC_BIN = TestProject.TTSC_BIN;
const WORKSPACE_ROOT = TestProject.WORKSPACE_ROOT;

function goTransformerSource() {
  return path.join(
    WORKSPACE_ROOT,
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

function copyProject(name: string) {
  return TestProject.copyProject(name);
}

function runNode(file: string, options?: any) {
  return TestProject.runNode(file, options);
}

function spawn(command: string, args: string[], options?: any) {
  return TestProject.spawn(command, args, options);
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
  TTSC_BIN as ttscBin,
  WORKSPACE_ROOT as workspaceRoot,
};

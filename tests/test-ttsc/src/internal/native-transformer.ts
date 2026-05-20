/**
 * Shared helpers for tests that exercise the native Go transformer integration.
 * Provides the workspace-relative path to the go-transformer test binary and a
 * PATH helper that prepends a local Go SDK when present.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TTSC_BIN = TestProject.TTSC_BIN;
const WORKSPACE_ROOT = TestProject.WORKSPACE_ROOT;

/**
 * Returns the source directory of the workspace's go-transformer test binary
 * (`tests/go-transformer/cmd/ttsc-go-transformer`). Used by tests that need a
 * real compiled Go transformer without building a fixture plugin from scratch.
 */
function goTransformerSource() {
  return path.join(
    WORKSPACE_ROOT,
    "tests",
    "go-transformer",
    "cmd",
    "ttsc-go-transformer",
  );
}

/**
 * Returns a PATH string that prepends `~/go-sdk/go/bin` when that directory
 * exists (common in CI environments that install Go via the workspace script),
 * falling back to `process.env.PATH` otherwise.
 */
function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

/** Copies a named fixture from `tests/projects` into a fresh temp directory. */
function copyProject(name: string) {
  return TestProject.copyProject(name);
}

/** Runs the compiled JS file directly via Node.js. */
function runNode(file: string, options?: any) {
  return TestProject.runNode(file, options);
}

/** Spawns a command with standard test defaults (encoding, maxBuffer, etc.). */
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

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function commonJsProject(files: Record<string, string>, options?: any) {
  return TestProject.commonJsProject(files, options);
}

function createProject(files: Record<string, string>) {
  return TestProject.createProject(files);
}

function runNode(file: string, options?: any) {
  return TestProject.runNode(file, options);
}

function spawn(command: string, args: string[], options?: any) {
  return TestProject.spawn(command, args, options);
}

const TTSC_BIN = TestProject.TTSC_BIN;

export {
  assert,
  commonJsProject,
  createProject,
  fs,
  path,
  runNode,
  spawn,
  TTSC_BIN as ttscBin,
};

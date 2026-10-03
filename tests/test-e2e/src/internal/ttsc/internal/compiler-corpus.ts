/**
 * Thin re-export module for compiler corpus tests. Surfaces the subset of
 * `@ttsc/testing` helpers that the compiler corpus feature files use, keeping
 * each feature file free of direct `TestProject` boilerplate.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Creates a CJS project with `@ttsc/testing` defaults. */
function commonJsProject(files: Record<string, string>, options?: any) {
  return TestProject.commonJsProject(files, options);
}

/** Creates an empty temp project populated with the given files. */
function createProject(files: Record<string, string>) {
  return TestProject.createProject(files);
}

/** Runs the compiled JS file directly via Node.js. */
function runNode(file: string, options?: any) {
  return TestProject.runNode(file, options);
}

/** Spawns a command with standard test defaults (encoding, maxBuffer, etc.). */
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

#!/usr/bin/env node

import { runGraph } from "./index";
import { GraphArgumentError } from "./launcherArgs";

try {
  const code = runGraph(process.argv.slice(2));
  if (typeof code === "number") {
    process.exitCode = code;
  }
} catch (error) {
  if (error instanceof GraphArgumentError) {
    process.stderr.write(`@ttsc/graph: ${error.message}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}

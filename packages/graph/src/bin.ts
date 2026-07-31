#!/usr/bin/env node

import { runGraph } from "./index";
import { GraphArgumentError } from "./launcherArgs";

async function main(): Promise<void> {
  try {
    const code = await runGraph(process.argv.slice(2));
    if (typeof code === "number") {
      process.exitCode = code;
    }
  } catch (error) {
    if (error instanceof GraphArgumentError) {
      process.stderr.write(`@ttsc/graph: ${error.message}\n`);
      process.exitCode = 2;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${message.startsWith("@ttsc/graph:") ? message : `@ttsc/graph: ${message}`}\n`,
    );
    process.exitCode = 1;
  }
}

void main();

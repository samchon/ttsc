#!/usr/bin/env node

import { runTtsc } from "./internal/runTtsc";

const code = runTtsc(process.argv.slice(2));
if (typeof code === "number") {
  process.exitCode = code;
}

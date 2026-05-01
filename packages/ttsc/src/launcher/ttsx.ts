#!/usr/bin/env node

import { runTtsx } from "./internal/runTtsx";

const code = runTtsx(process.argv.slice(2));
if (typeof code === "number") {
  process.exitCode = code;
}

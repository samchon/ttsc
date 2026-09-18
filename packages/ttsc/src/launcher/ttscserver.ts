#!/usr/bin/env node

import { runTtscserver } from "./internal/ttscserver/runTtscserver";

const code = runTtscserver(process.argv.slice(2));
if (typeof code === "number") {
  process.exitCode = code;
}

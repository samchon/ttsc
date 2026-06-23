#!/usr/bin/env node

import { runGraph } from "./index";

const code = runGraph(process.argv.slice(2));
if (typeof code === "number") {
  process.exitCode = code;
}

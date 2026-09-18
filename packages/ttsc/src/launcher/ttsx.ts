#!/usr/bin/env node

import { runTtsx } from "./internal/runTtsx";

void runTtsx(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});

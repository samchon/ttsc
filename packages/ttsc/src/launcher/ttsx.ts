#!/usr/bin/env node

import { main } from "../runner/cli";

const code = main(process.argv.slice(2));
if (typeof code === "number") {
  process.exitCode = code;
}

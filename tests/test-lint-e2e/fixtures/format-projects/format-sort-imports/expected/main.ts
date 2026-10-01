import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { x } from "./local-a";
import { reduce } from "./local-b";

JSON.stringify({ reduce, writeFileSync, readFileSync, x, resolve });

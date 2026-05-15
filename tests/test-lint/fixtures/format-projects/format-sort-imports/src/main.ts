import { reduce } from "./local-b";
import { writeFileSync, readFileSync } from "node:fs";
import { x } from "./local-a";
import { resolve } from "node:path";

JSON.stringify({ reduce, writeFileSync, readFileSync, x, resolve });

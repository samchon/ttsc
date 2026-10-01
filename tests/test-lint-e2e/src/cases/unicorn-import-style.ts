// Default policies: import path/chalk by default import only, util by named only.
// expect: unicorn/import-style error
import * as path from "node:path";
// expect: unicorn/import-style error
import util from "node:util";
// expect: unicorn/import-style error
import { red } from "chalk";
import { inspect } from "node:util";
import pathDefault from "node:path";
import * as fs from "node:fs";

void path;
void util;
void red;
void inspect;
void pathDefault;
void fs;

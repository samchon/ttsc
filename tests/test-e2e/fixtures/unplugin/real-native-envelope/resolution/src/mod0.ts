import type { Shared } from "typed-dep";
import { linked } from "linked-pkg";
import { esm } from "./esm.mjs";
import { relative } from "./relative.js";

export const value0: Shared = { label: [linked, "0", esm, relative].join(":") };

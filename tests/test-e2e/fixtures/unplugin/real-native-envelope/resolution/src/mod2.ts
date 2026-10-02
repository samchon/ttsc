import type { Shared } from "typed-dep";
import { linked } from "linked-pkg";
import { rooted } from "./rooted.js";

export const value2: Shared = { label: [linked, "2", rooted].join(":") };

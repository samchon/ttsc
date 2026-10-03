import type { Shared } from "typed-dep";
import { linked } from "linked-pkg";

export const value1: Shared = { label: [linked, "1"].join(":") };

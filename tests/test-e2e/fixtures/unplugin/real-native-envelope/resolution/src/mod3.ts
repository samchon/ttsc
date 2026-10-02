import type { Shared } from "typed-dep";
import { linked } from "linked-pkg";
import { feature } from "exports-pkg/feature";
import { jsx } from "./react.jsx";

export const value3: Shared = { label: [linked, "3", feature, jsx].join(":") };

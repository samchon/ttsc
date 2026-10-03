import { common } from "./common.cjs";
import { pathValue } from "@fixture/value";
import { encode } from "punycode";

export const predicate = encode("proof") + common + pathValue;

import { common } from "./common.cjs";
import { encode } from "punycode";

export const predicate = encode("proof") + common;

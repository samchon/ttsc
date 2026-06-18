import type { ThisTypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ThisTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created node.
 */
export const createThisTypeNode = (): ThisTypeNode => make("ThisTypeNode", {});

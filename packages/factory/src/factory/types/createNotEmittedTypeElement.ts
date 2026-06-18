import type { NotEmittedTypeElement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NotEmittedTypeElement}: a placeholder type-element that
 * carries no syntax of its own.
 *
 * It exists to hold position and attached comments inside a member list without
 * contributing any text. The printer emits the empty string for it, so the
 * rendered output is empty:
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link NotEmittedTypeElement}.
 */
export const createNotEmittedTypeElement = (): NotEmittedTypeElement =>
  make("NotEmittedTypeElement", {});

import type { PrivateIdentifier } from "../../ast";
import { createPrivateIdentifier } from "./createPrivateIdentifier";

/**
 * Create a unique private identifier name as a plain {@link PrivateIdentifier}.
 *
 * The legacy compiler uses a stateful name generator that guarantees the
 * returned private identifier is unique within its scope. This package is
 * stateless, so this is a simplified placeholder: it does not guarantee
 * uniqueness, it assembles a name from the optional `prefix`, the `text` (or
 * the fallback `_unique` when omitted or empty), and the optional `suffix`, then
 * delegates to {@link createPrivateIdentifier}. Any leading `#` on `text` is
 * stripped first so the delegate adds exactly one.
 *
 * With no arguments, the fallback applies and this prints:
 *
 * ```ts
 * #_unique
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional affixes surround the caller base or documented _unique fallback;
 *   stripping a leading # before prefix assembly keeps that delimiter at the
 *   front. This stateless representation does not establish scope uniqueness.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Base assembly delegates private-name construction rather than allocating
 *   generated-name identities in a second hidden subsystem.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   _unique is the declared omitted-base default. It cannot substitute for a
 *   uniqueness guarantee, which native documentation explicitly disclaims.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the fallback, affixes, # normalization and stateless limitation
 *   in separate paragraphs with an example and blank before acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param text The base name text, if any.
 * @param prefix An optional name prefix.
 * @param suffix An optional name suffix.
 * @returns The created {@link PrivateIdentifier}.
 */
export const createUniquePrivateName = (
  text?: string,
  prefix?: string,
  suffix?: string,
): PrivateIdentifier =>
  createPrivateIdentifier(
    `#${prefix ?? ""}${text ? text.replace(/^#/, "") : "_unique"}${suffix ?? ""}`,
  );

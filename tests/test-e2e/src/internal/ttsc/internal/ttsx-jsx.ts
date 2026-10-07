import fixture from "./runtime-jsx-fixture.json" with { type: "json" };

/**
 * Authored myjsx package supporting classic, automatic and development
 * transforms.
 */
export const JSX_RUNTIME_PACKAGE: Readonly<Record<string, string>> =
  fixture.files;

/** A component using an element, nested text, and a fragment. */
export const JSX_COMPONENT_SOURCE = fixture.source;

/** The literal HTML specified by the authored component and runtime. */
export const JSX_COMPONENT_OUTPUT = fixture.expected;

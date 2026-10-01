import fixture from "./runtime-decorator-fixture.json" with { type: "json" };

/** Standard decorator witness from #1359, with observable replacement behavior. */
export const STANDARD_DECORATOR_SOURCE = fixture.source;

export const STANDARD_DECORATOR_OUTPUT = fixture.expected;

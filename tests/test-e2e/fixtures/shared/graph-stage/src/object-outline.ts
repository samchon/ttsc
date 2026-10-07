const shorthand = 1;
const dynamic = Math.random() > 0.5 ? "a" : "b";
const spread = { fromSpread: true };

export const shape = (({
  /* { */
  real: 1,
  close: "}",
  text: "{",
  shorthand,
  ["static-key"]: 2,
  [""]: 4,
  [1]: true,
  [dynamic]: 3,
  method() { return "METHOD_BODY_MUST_NOT_APPEAR"; },
  get value() { return "ACCESSOR_BODY_MUST_NOT_APPEAR"; },
  set value(input: number) { void "SETTER_BODY_MUST_NOT_APPEAR"; },
  run: () => "ARROW_BODY_MUST_NOT_APPEAR",
  classic: function () { return "FUNCTION_BODY_MUST_NOT_APPEAR"; },
  klass: class { method() { return "CLASS_BODY_MUST_NOT_APPEAR"; } },
  list: ["ARRAY_CONTENT_MUST_NOT_APPEAR"],
  nested: { inner: "NESTED_BODY_MUST_NOT_APPEAR" },
  ...spread,
  /* } */
  afterSpread: true,
}) as const) satisfies Record<PropertyKey, unknown>;

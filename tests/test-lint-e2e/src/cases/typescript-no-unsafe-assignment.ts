declare const leaked: any;

// Direct annotated assignments are unsafe.
// expect: typescript/no-unsafe-assignment error
const explicit: string = leaked;

// `unknown` keeps the narrowing boundary and is allowed.
const allowedUnknown: unknown = leaked;

// Inferred variables still let `any` escape.
// expect: typescript/no-unsafe-assignment error
const inferred = leaked;

// Direct `any` destructuring reports once at the boundary.
// expect: typescript/no-unsafe-assignment error
const [destructured] = leaked;

function withDefault(
  // expect: typescript/no-unsafe-assignment error
  value = leaked,
): unknown {
  return value;
}

class Container {
  // expect: typescript/no-unsafe-assignment error
  public value = leaked;

  // expect: typescript/no-unsafe-assignment error
  public accessor accessorValue = leaked;
}

// Matching generic targets are compared recursively.
// expect: typescript/no-unsafe-assignment error
const genericTarget: Set<Set<string>> = new Set<Set<any>>();
const genericUnknown: Set<Set<unknown>> = new Set<Set<any>>();

export {
  allowedUnknown,
  Container,
  destructured,
  explicit,
  genericTarget,
  genericUnknown,
  inferred,
  withDefault,
};

// Positive: empty body, no parameters.
class EmptyNoParams {
  // expect: typescript/no-useless-constructor error
  constructor() {}
}

// Positive: empty body, plain parameters.
class EmptyPlainParams {
  // expect: typescript/no-useless-constructor error
  constructor(_name: string, _count: number) {}
}

// Negative: parameter property declares a field.
class WithParameterProperty {
  constructor(public name: string) {}
}

// Negative: at least one parameter is a parameter property.
class MixedParameters {
  constructor(
    public id: number,
    _plain: string,
  ) {}
}

// Negative: non-empty body.
class WithBody {
  count: number;
  constructor() {
    this.count = 0;
  }
}

JSON.stringify({
  EmptyNoParams,
  EmptyPlainParams,
  WithParameterProperty,
  MixedParameters,
  WithBody,
});

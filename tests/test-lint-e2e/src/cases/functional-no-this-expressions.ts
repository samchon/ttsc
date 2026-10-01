declare const value: unknown;

function read(this: { value: unknown }) {
  // expect: functional/no-this-expressions error
  return this.value;
}

JSON.stringify({ read, value });

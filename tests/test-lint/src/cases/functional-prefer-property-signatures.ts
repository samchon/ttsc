interface Api {
  // expect: functional/prefer-property-signatures error
  run(): void;
}

declare const api: Api;
JSON.stringify(api);

// @ttsc-corpus-options: unicorn/string-content {"patterns":{"no":"yes","unicorn":{"suggest":"🦄"}}}
// expect: unicorn/string-content error
"no directive";

declare function gql(strings: TemplateStringsArray, ...values: unknown[]): string;
declare function tag(strings: TemplateStringsArray, ...values: unknown[]): string;

// expect: unicorn/string-content error
const literal = "no";

// expect: unicorn/string-content error
const emoji = `a unicorn`;

// expect: unicorn/string-content error
const quasi = tag`no${literal}`;

// Negative: foreign-language tags exempt their quasis, and identifiers inside
// substitutions are not string content.
const ignored = gql`{ field(input: 'no') }`;
const substitution = `${literal}${emoji}${quasi}${ignored}`;

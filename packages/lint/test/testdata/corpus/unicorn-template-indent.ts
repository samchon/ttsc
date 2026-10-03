declare function sql(strings: TemplateStringsArray): string;

// expect: unicorn/template-indent error
const query = sql`
SELECT *
  FROM users
`;

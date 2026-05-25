export interface IPlaygroundExample {
  id: string;
  title: string;
  description: string;
  source: string;
  group: "typia" | "lint" | "mixed";
}

export const PLAYGROUND_EXAMPLES: IPlaygroundExample[] = [
  {
    id: "typia-is",
    group: "typia",
    title: "typia.is — Type Guard",
    description: "Compile-time generated validator for a member shape.",
    source: `import typia, { tags } from "typia";

interface IMember {
  id: string & tags.Format<"uuid">;
  email: string & tags.Format<"email">;
  age: number &
    tags.Type<"uint32"> &
    tags.ExclusiveMinimum<19> &
    tags.Maximum<100>;
}

const member: IMember = {
  id: "8f5d2f3a-3f3b-4a3a-9bba-3a3b4a3a9bba",
  email: "samchon.github@gmail.com",
  age: 30,
};

const matched: boolean = typia.is<IMember>(member);
console.log({ matched, member });
`,
  },
  {
    id: "typia-random",
    group: "typia",
    title: "typia.random — Sample Data",
    description: "Generate random instances of a typed structure.",
    source: `import typia, { tags } from "typia";

interface IArticle {
  id: string & tags.Format<"uuid">;
  title: string;
  body: string;
  views: number & tags.Type<"uint32">;
  tags: Array<string>;
}

const article: IArticle = typia.random<IArticle>();
console.log(article);
`,
  },
  {
    id: "typia-json",
    group: "typia",
    title: "typia.json — Faster JSON",
    description: "Stringify and validate JSON using compile-time schema.",
    source: `import typia, { tags } from "typia";

interface IPoint {
  x: number;
  y: number;
  label: string & tags.MinLength<1>;
}

const point: IPoint = { x: 3, y: 4, label: "origin" };
const json: string = typia.json.stringify<IPoint>(point);
const parsed = typia.json.assertParse<IPoint>(json);

console.log({ json, parsed });
`,
  },
  {
    id: "lint-no-var",
    group: "lint",
    title: "@ttsc/lint - noVar · preferConst",
    description: "See lint violations in the same stream as type errors.",
    source: `var greeting = "hello";
let target = "ttsc";
console.log(greeting + ", " + target);
`,
  },
  {
    id: "lint-quotes",
    group: "lint",
    title: "@ttsc/lint - formatQuotes · formatSemi",
    description: "Mixed quotes and missing semicolons.",
    source: `const greeting = 'hello'
const target = "ttsc"
const sentence = greeting + ', ' + target
console.log(sentence)
`,
  },
  {
    id: "mixed",
    group: "mixed",
    title: "typia + lint together",
    description: "Both plugins run in one pass.",
    source: `import typia, { tags } from "typia";

var name = "ttsc";

interface IProject {
  name: string & tags.MinLength<1>;
  stars: number & tags.Type<"uint32">;
}

let project: IProject = { name, stars: 0 };
console.log(typia.is<IProject>(project));
`,
  },
];

export const PLAYGROUND_DEFAULT_SCRIPT = PLAYGROUND_EXAMPLES[0].source;

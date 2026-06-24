package mcp_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreExpandsExactCallPath verifies query_nodes expands a public method
// mention into its downstream relation-flow calls.
//
// The TypeORM relation benchmark asks about `repository.find()`, while agents
// often rewrite that to a graph query like `Repository find options relations`.
// Both forms must continue through the manager and query builder. Without anchor
// filtering, sibling `find*` methods crowd the result; without call-path
// expansion, the manager body is only an edge target and thorough agents read the
// file anyway.
//
//  1. Compile a fixture whose Repository.find reaches Manager.find and then
//     QueryBuilder.setFindOptions/applyFindOptions/buildRelations.
//  2. Ask the benchmark shape and the natural owner/member query shape Codex
//     emits.
//  3. Assert the downstream path bodies appear and the sibling findAndCount does
//     not crowd the result.
func TestExploreExpandsExactCallPath(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `
export class Repository {
  constructor(private readonly manager: Manager) {}

  find(options?: FindOptions): string[] {
    return this.manager.find("entity", options);
  }

  findAndCount(options?: FindOptions): [string[], number] {
    return [this.manager.find("entity", options), 0];
  }
}

export class Manager {
  find(entity: string, options?: FindOptions): string[] {
    return this.createQueryBuilder(entity).setFindOptions(options ?? {}).getMany();
  }

  createQueryBuilder(entity: string): QueryBuilder {
    return new QueryBuilder(entity);
  }
}

export class FindOptionsUtils {
  static rejectJoinOption(options: FindOptions): void {
    void options;
  }

  static rejectStringArrayRelations(options: FindOptions): void {
    void options;
  }
}

export class QueryBuilder {
  private findOptions?: FindOptions;
  private expressionMap = new QueryExpressionMap();

  constructor(private readonly entity: string) {}

  setFindOptions(findOptions: FindOptions): this {
    FindOptionsUtils.rejectJoinOption(findOptions);
    FindOptionsUtils.rejectStringArrayRelations(findOptions);
    this.findOptions = findOptions;
    this.applyFindOptions();
    return this;
  }

  protected applyFindOptions(): void {
    if (this.findOptions?.relations) {
      this.buildRelations(this.findOptions.relations);
    }
  }

  protected buildRelations(relations: Record<string, boolean>): void {
    for (const relationName of Object.keys(relations)) {
      void this.getRelationJoinType();
      this.join(relationName);
    }
  }

  protected getRelationJoinType(): "inner" | "left" {
    return "inner";
  }

  protected join(relationName: string): void {
    const joinAttribute = new JoinAttribute("root." + relationName, relationName);
    joinAttribute.alias = relationName;
    this.expressionMap.joinAttributes.push(joinAttribute);
  }

  protected createJoinExpression(): string {
    return this.expressionMap.joinAttributes
      .map((joinAttribute) => this.createJoinTreeRecursively(joinAttribute))
      .join(" ");
  }

  protected createJoinTreeRecursively(joinAttribute: JoinAttribute): string {
    return joinAttribute.parentAlias + ":" + joinAttribute.alias + ":" + joinAttribute.relation;
  }

  getMany(): string[] {
    this.createJoinExpression();
    return [this.entity];
  }
}

export class QueryExpressionMap {
  joinAttributes: JoinAttribute[] = [];
}

export class JoinAttribute {
  alias = "";

  constructor(
    public readonly entityOrProperty: string,
    private readonly relationName: string,
  ) {}

  get parentAlias(): string | undefined {
    return this.entityOrProperty.slice(0, this.entityOrProperty.indexOf("."));
  }

  get relation(): string {
    return this.relationName;
  }
}

export interface FindOptions {
  relations?: Record<string, boolean>;
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  cases := []string{
    "How are relation options applied when Repository.find() builds its query? Trace the call path from the public find method to where the relations are resolved and joined into the query.",
    "Repository find options relations query builder apply relations joins join attributes alias",
  }
  for _, query := range cases {
    text := toolText(t, server, fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":%q}}}`, query))
    for _, want := range []string{
      "method Repository.find",
      "method Manager.find",
      "method QueryBuilder.setFindOptions",
      "method QueryBuilder.applyFindOptions",
      "method QueryBuilder.buildRelations",
    } {
      if !strings.Contains(text, want) {
        t.Fatalf("query_nodes did not include %s for query %q in the expanded path:\n%s", want, query, text)
      }
    }
    for _, noisy := range []string{
      "\nmethod Repository.findAndCount",
      "\nmethod Repository.query",
      "\nmethod QueryBuilder.getRelationJoinType",
    } {
      if strings.Contains(text, noisy) {
        t.Fatalf("query_nodes rendered noisy sibling %s for query %q:\n%s", noisy, query, text)
      }
    }
    for _, guard := range []string{
      "rejectJoinOption",
      "rejectStringArrayRelations",
    } {
      if strings.Contains(text, guard) {
        t.Fatalf("query_nodes rendered flow guard %s for query %q:\n%s", guard, query, text)
      }
    }
  }
}

func TestExploreFollowsRelevantValueConsumers(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `
export class QueryExpressionMap {
  joinAttributes: string[] = [];
}

export class Builder {
  private expressionMap = new QueryExpressionMap();

  join(attribute: string): void {
    this.expressionMap.joinAttributes.push(attribute);
  }

  createJoinExpression(): string {
    return this.expressionMap.joinAttributes.join(" ");
  }
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"Builder QueryExpressionMap.joinAttributes join attributes","mode":"flow"}}}`)
  for _, want := range []string{
    "variable QueryExpressionMap.joinAttributes",
    "method Builder.createJoinExpression",
  } {
    if !strings.Contains(text, want) {
      t.Fatalf("query_nodes did not include %s in the reverse consumer flow:\n%s", want, text)
    }
  }
}

package mcp_test

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestGraphExploreDeSurfacesGitIgnoredGeneratedCode verifies that a source file
// git ignores (generated output, e.g. a Prisma client emitted as .ts into the
// tree) does not rank as a primary match, so it cannot drown the authored code,
// yet stays reachable by an exact name query.
//
// driver.SourceFiles already drops .d.ts, but a generated .ts becomes a node and,
// being large and highly connected, would otherwise dominate ranking. The matcher
// reads `git check-ignore`, so this pins both halves: a broad keyword that the
// generated class name contains must not surface it, while its exact name still
// reaches it.
//
//  1. Build a git work tree whose .gitignore covers src/generated.
//  2. Lazy-load a server over it (cwd set, so the ignore check runs).
//  3. Assert the broad match hides the generated class but shows app code, and the
//     exact-name query reaches the generated class.
func TestGraphExploreDeSurfacesGitIgnoredGeneratedCode(t *testing.T) {
	root := t.TempDir()
	runGit(t, root, "init")
	writeFile(t, filepath.Join(root, ".gitignore"), "src/generated/\n")
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/app.ts", "src/generated/client.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "generated", "client.ts"), `export class ZzzGeneratedClient {
  run(): number {
    return 1
  }
}
`)
	writeFile(t, filepath.Join(root, "src", "app.ts"), `import { ZzzGeneratedClient } from "./generated/client"

export class AppService {
  client = new ZzzGeneratedClient()
}
`)

	server := mcp.NewLazyServer(root, "tsconfig.json", driver.LoadProgramOptions{})

	// Broad match: the generated class is de-surfaced, so its body is not dumped
	// as a primary node. Its name may still appear as an edge target of the app
	// code, which is the point: reachable, not dominant. The authored code ranks.
	broad := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"client service"}}}`)
	if strings.Contains(broad, "run(): number") {
		t.Fatalf("git-ignored generated body was dumped as a primary match:\n%s", broad)
	}
	if !strings.Contains(broad, "AppService") {
		t.Fatalf("authored code missing from the broad match:\n%s", broad)
	}

	// Exact name still reaches it, body and all.
	exact := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"ZzzGeneratedClient"}}}`)
	if !strings.Contains(exact, "run(): number") {
		t.Fatalf("exact-name query did not reach the git-ignored class body:\n%s", exact)
	}
}

// runGit runs a git subcommand in dir, failing the test on error.
func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

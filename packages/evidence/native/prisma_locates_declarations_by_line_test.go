package evidence

import (
  "sort"
  "strings"
  "testing"
)

func prismaLocationsOf(content string) map[string]prismaLocation {
  locations := map[string]prismaLocation{}
  scanPrismaFile("prisma/schema.prisma", content, locations)
  return locations
}

// prismaCommentsOf renders each scanned comment run as
// `form@line->key: body`, so a case can assert attachment and grouping in one
// comparison instead of reaching into the slice.
func prismaCommentsOf(content string) string {
  scan := scanPrismaFile(
    "prisma/schema.prisma",
    content,
    map[string]prismaLocation{},
  )
  // Ordered by starting line so a case reads in file order rather than in
  // whatever order grouping happened to append.
  runs := append([]prismaCommentRun(nil), scan.Comments...)
  sort.SliceStable(runs, func(left int, right int) bool {
    return runs[left].Line < runs[right].Line
  })
  rendered := make([]string, 0, len(runs))
  for _, run := range runs {
    rendered = append(rendered, string(run.Form)+"@"+decimal(run.Line)+"->"+run.Key+": "+strings.ReplaceAll(run.Body, "\n", "|"))
  }
  return strings.Join(rendered, "\n")
}

func assertPrismaLine(
  t *testing.T,
  locations map[string]prismaLocation,
  key string,
  line int,
) {
  t.Helper()
  found, exists := locations[key]
  if !exists {
    t.Fatalf("%q was not located; found %v", key, prismaLocationKeys(locations))
  }
  if found.Line != line {
    t.Fatalf("%q located at line %d, want %d", key, found.Line, line)
  }
}

func prismaLocationKeys(locations map[string]prismaLocation) []string {
  keys := make([]string, 0, len(locations))
  for key := range locations {
    keys = append(keys, key)
  }
  return keys
}

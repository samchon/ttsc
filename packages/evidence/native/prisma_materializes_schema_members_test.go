package evidence

import (
  "strings"
)

// prismaUnitIndex renders materialized units as `target=symbol` lines, ordered
// as materialization produced them, so a case can assert the whole set at once
// rather than one property at a time.
func prismaUnitIndex(units []*evidenceUnit) string {
  rendered := make([]string, 0, len(units))
  for _, unit := range units {
    rendered = append(rendered, unit.Target+"="+unit.Symbol)
  }
  return strings.Join(rendered, "\n")
}

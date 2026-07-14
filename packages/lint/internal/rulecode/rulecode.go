// Package rulecode allocates the positive TS-style diagnostic codes shared by
// the lint host and its built-in ledger generator.
package rulecode

import (
	"fmt"
	"sort"
)

const (
	// Minimum is the first diagnostic code reserved for lint rules.
	Minimum int32 = 9000
	// MaximumExclusive is one past the last diagnostic code reserved for lint rules.
	MaximumExclusive int32 = 18000
)

// Legacy returns the historical FNV-1a code for name. Allocate uses this as
// the preferred code so rules without a collision retain their original code.
func Legacy(name string) int32 {
	const prime = 16777619
	var hash uint32 = 2166136261
	for i := 0; i < len(name); i++ {
		hash ^= uint32(name[i])
		hash *= prime
	}
	return Minimum + int32(hash%uint32(MaximumExclusive-Minimum))
}

// Allocate returns a collision-free assignment containing frozen and every
// requested name. Frozen entries are immutable, including entries for removed
// rules, so adding a name can never renumber or reuse an existing assignment.
// Missing names are sorted before allocation, making the result independent of
// registration order. Their legacy codes are reserved as a group before any
// collision is probed so a collision loser cannot displace an unrelated rule.
func Allocate(frozen map[string]int32, names []string) (map[string]int32, error) {
	assigned := make(map[string]int32, len(frozen)+len(names))
	used := make(map[int32]string, len(frozen)+len(names))
	for name, code := range frozen {
		if code < Minimum || code >= MaximumExclusive {
			return nil, fmt.Errorf("rule %q has out-of-range diagnostic code %d", name, code)
		}
		if previous, exists := used[code]; exists {
			return nil, fmt.Errorf("rules %q and %q share diagnostic code %d", previous, name, code)
		}
		assigned[name] = code
		used[code] = name
	}

	sortedNames := append([]string(nil), names...)
	sort.Strings(sortedNames)
	missing := make([]string, 0, len(sortedNames))
	for index, name := range sortedNames {
		if index > 0 && sortedNames[index-1] == name {
			continue
		}
		if _, exists := assigned[name]; exists {
			continue
		}
		code := Legacy(name)
		if _, occupied := used[code]; occupied {
			missing = append(missing, name)
			continue
		}
		assigned[name] = code
		used[code] = name
	}

	for _, name := range missing {
		code, ok := firstAvailable(Legacy(name), used)
		if !ok {
			return nil, fmt.Errorf("lint diagnostic code range [%d, %d) is exhausted", Minimum, MaximumExclusive)
		}
		assigned[name] = code
		used[code] = name
	}
	return assigned, nil
}

func firstAvailable(preferred int32, used map[int32]string) (int32, bool) {
	width := MaximumExclusive - Minimum
	for offset := int32(1); offset < width; offset++ {
		candidate := Minimum + (preferred-Minimum+offset)%width
		if _, occupied := used[candidate]; !occupied {
			return candidate, true
		}
	}
	return 0, false
}

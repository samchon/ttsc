// Grapheme-cluster string length, mirroring typescript-eslint's
// `getStringLength` utility. Directive descriptions are measured as Unicode
// extended grapheme clusters, the same units exposed by `Intl.Segmenter` with
// `granularity: "grapheme"`, rather than bytes, UTF-16 code units, or runes.
//
// The implementation follows the ordered extended-cluster rules in UAX #29.
// Its generated property tables are pinned to Unicode 16.0.0, the Unicode
// version used by the Node 24 runtime in this repository's CI. Regenerate the
// tables and official conformance corpus together when that runtime advances.
package linthost

//go:generate go run ../tools/graphemegen -root ..

// stringLength returns the number of Unicode extended grapheme clusters in s.
func stringLength(s string) int {
	return graphemeCount(s)
}

// graphemeCount applies UAX #29's ordered boundary rules in one pass. The
// segmenter carries only the left contexts required by GB9c, GB11, and
// GB12/GB13, keeping long combining and regional-indicator runs linear.
func graphemeCount(s string) int {
	count := 0
	var segmenter graphemeSegmenter
	for _, current := range s {
		properties := graphemeProperties(current)
		if segmenter.hasBoundaryBefore(properties) {
			count++
		}
		segmenter.consume(properties)
	}
	return count
}

type graphemePropertiesValue struct {
	breakClass          graphemeBreakClass
	indicConjunctClass indicConjunctBreakClass
	extendedPictographic bool
}

type indicConjunctState uint8

const (
	indicConjunctStateNone indicConjunctState = iota
	indicConjunctStateConsonant
	indicConjunctStateLinked
)

type emojiSequenceState uint8

const (
	emojiSequenceStateNone emojiSequenceState = iota
	emojiSequenceStatePictographic
	emojiSequenceStateZWJ
)

type graphemeSegmenter struct {
	hasPrevious       bool
	previous          graphemePropertiesValue
	regionalIndicators int
	indicConjunct     indicConjunctState
	emojiSequence     emojiSequenceState
}

// hasBoundaryBefore applies GB3 through GB999 in normative order. Start of
// text is always a boundary (GB1); end of text needs no explicit handling when
// only the number of clusters is required.
func (s *graphemeSegmenter) hasBoundaryBefore(current graphemePropertiesValue) bool {
	if !s.hasPrevious {
		return true
	}
	previous := s.previous.breakClass
	next := current.breakClass

	// GB3: keep CRLF together.
	if previous == graphemeBreakCR && next == graphemeBreakLF {
		return false
	}
	// GB4/GB5: otherwise break before and after controls.
	if isGraphemeControlClass(previous) || isGraphemeControlClass(next) {
		return true
	}
	// GB6-GB8: keep Hangul and other data-defined conjoining sequences.
	if isHangulGraphemeJoin(previous, next) {
		return false
	}
	// GB9/GB9a: extending characters, ZWJ, and spacing marks continue the
	// current cluster.
	if next == graphemeBreakExtend || next == graphemeBreakZWJ || next == graphemeBreakSpacingMark {
		return false
	}
	// GB9b: Prepend joins the following non-control character.
	if previous == graphemeBreakPrepend {
		return false
	}
	// GB9c: an Indic consonant-linker sequence joins its next consonant.
	if current.indicConjunctClass == indicConjunctBreakConsonant && s.indicConjunct == indicConjunctStateLinked {
		return false
	}
	// GB11: Extended_Pictographic Extend* ZWJ joins the next pictograph.
	if current.extendedPictographic && s.emojiSequence == emojiSequenceStateZWJ {
		return false
	}
	// GB12/GB13: regional indicators join in pairs. The state is the
	// uninterrupted RI count immediately before this boundary.
	if next == graphemeBreakRegionalIndicator && s.regionalIndicators%2 == 1 {
		return false
	}
	// GB999: all remaining positions are boundaries.
	return true
}

func (s *graphemeSegmenter) consume(current graphemePropertiesValue) {
	if current.breakClass == graphemeBreakRegionalIndicator {
		s.regionalIndicators++
	} else {
		s.regionalIndicators = 0
	}

	switch current.indicConjunctClass {
	case indicConjunctBreakConsonant:
		s.indicConjunct = indicConjunctStateConsonant
	case indicConjunctBreakExtend:
		// Extend preserves a preceding consonant/linker context.
	case indicConjunctBreakLinker:
		if s.indicConjunct != indicConjunctStateNone {
			s.indicConjunct = indicConjunctStateLinked
		}
	default:
		s.indicConjunct = indicConjunctStateNone
	}

	switch {
	case current.extendedPictographic:
		s.emojiSequence = emojiSequenceStatePictographic
	case current.breakClass == graphemeBreakExtend && s.emojiSequence == emojiSequenceStatePictographic:
		// Extend preserves the pictograph context immediately before a ZWJ.
	case current.breakClass == graphemeBreakZWJ && s.emojiSequence == emojiSequenceStatePictographic:
		s.emojiSequence = emojiSequenceStateZWJ
	default:
		s.emojiSequence = emojiSequenceStateNone
	}

	s.previous = current
	s.hasPrevious = true
}

func graphemeProperties(r rune) graphemePropertiesValue {
	return graphemePropertiesValue{
		breakClass:          lookupGraphemeBreakClass(r),
		indicConjunctClass: lookupIndicConjunctBreakClass(r),
		extendedPictographic: isExtendedPictographic(r),
	}
}

func lookupGraphemeBreakClass(r rune) graphemeBreakClass {
	lo, hi := 0, len(graphemeBreakRanges)
	for lo < hi {
		middle := int(uint(lo+hi) >> 1)
		candidate := graphemeBreakRanges[middle]
		switch {
		case r < candidate.lo:
			hi = middle
		case r > candidate.hi:
			lo = middle + 1
		default:
			return candidate.class
		}
	}
	return graphemeBreakOther
}

func lookupIndicConjunctBreakClass(r rune) indicConjunctBreakClass {
	lo, hi := 0, len(indicConjunctBreakRanges)
	for lo < hi {
		middle := int(uint(lo+hi) >> 1)
		candidate := indicConjunctBreakRanges[middle]
		switch {
		case r < candidate.lo:
			hi = middle
		case r > candidate.hi:
			lo = middle + 1
		default:
			return candidate.class
		}
	}
	return indicConjunctBreakNone
}

func isExtendedPictographic(r rune) bool {
	lo, hi := 0, len(extendedPictographicRanges)
	for lo < hi {
		middle := int(uint(lo+hi) >> 1)
		candidate := extendedPictographicRanges[middle]
		switch {
		case r < candidate.lo:
			hi = middle
		case r > candidate.hi:
			lo = middle + 1
		default:
			return true
		}
	}
	return false
}

func isGraphemeControlClass(class graphemeBreakClass) bool {
	return class == graphemeBreakControl || class == graphemeBreakCR || class == graphemeBreakLF
}

func isHangulGraphemeJoin(previous, next graphemeBreakClass) bool {
	switch previous {
	case graphemeBreakL:
		return next == graphemeBreakL || next == graphemeBreakV || next == graphemeBreakLV || next == graphemeBreakLVT
	case graphemeBreakLV, graphemeBreakV:
		return next == graphemeBreakV || next == graphemeBreakT
	case graphemeBreakLVT, graphemeBreakT:
		return next == graphemeBreakT
	default:
		return false
	}
}

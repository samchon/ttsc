package linthost

import (
  "math"
  "math/big"
  "strings"
)

const (
  largestFiniteDecimalMagnitude   = 308
  smallestRoundedDecimalMagnitude = -324
)

type normalizedDecimalLiteral struct {
  coefficient       string
  magnitude         *big.Int
  significantDigits string
}

// numericLiteralLosesPrecision reports whether JavaScript's IEEE-754 Number
// conversion preserves the significant digits requested by a numeric literal.
// It handles every Number spelling while leaving BigInt literals alone.
func numericLiteralLosesPrecision(text string) bool {
  clean := strings.ReplaceAll(strings.TrimSpace(text), "_", "")
  if clean == "" || strings.HasSuffix(strings.ToLower(clean), "n") {
    return false
  }
  if clean[0] == '+' || clean[0] == '-' {
    clean = clean[1:]
  }
  if clean == "" {
    return false
  }

  if base, digits, ok := nonDecimalInteger(clean); ok {
    return integerLiteralLosesPrecision(digits, base)
  }

  literal, ok := normalizeDecimalLiteral(clean)
  if !ok || literal.significantDigits == "" {
    return false
  }
  if literal.magnitude.Cmp(big.NewInt(largestFiniteDecimalMagnitude)) > 0 ||
    literal.magnitude.Cmp(big.NewInt(smallestRoundedDecimalMagnitude)) < 0 {
    return true
  }

  magnitude := int(literal.magnitude.Int64())
  intended := decimalLiteralValue(literal.significantDigits, magnitude)
  stored, _ := intended.Float64()
  if math.IsInf(stored, 0) || stored == 0 {
    return true
  }
  coefficient, storedMagnitude := roundFloatToDecimalPrecision(
    stored,
    len(literal.coefficient),
  )
  return storedMagnitude != magnitude || coefficient != literal.coefficient
}

func nonDecimalInteger(text string) (base int, digits string, ok bool) {
  lower := strings.ToLower(text)
  for _, prefix := range []struct {
    marker string
    base   int
  }{
    {marker: "0b", base: 2},
    {marker: "0o", base: 8},
    {marker: "0x", base: 16},
  } {
    if strings.HasPrefix(lower, prefix.marker) {
      return prefix.base, text[len(prefix.marker):], true
    }
  }
  if len(text) > 1 && text[0] == '0' {
    for index := 1; index < len(text); index++ {
      if text[index] < '0' || text[index] > '7' {
        return 10, text, false
      }
    }
    return 8, text[1:], true
  }
  return 10, text, false
}

func integerLiteralLosesPrecision(digits string, base int) bool {
  intended, ok := new(big.Int).SetString(digits, base)
  if !ok {
    return false
  }
  stored, _ := new(big.Float).SetInt(intended).Float64()
  actual := new(big.Rat).SetFloat64(stored)
  return actual == nil || actual.Cmp(new(big.Rat).SetInt(intended)) != 0
}

func normalizeDecimalLiteral(text string) (normalizedDecimalLiteral, bool) {
  coefficientText := text
  exponent := new(big.Int)
  if index := strings.IndexAny(text, "eE"); index >= 0 {
    if strings.IndexAny(text[index+1:], "eE") >= 0 {
      return normalizedDecimalLiteral{}, false
    }
    coefficientText = text[:index]
    exponentText := text[index+1:]
    if exponentText == "" {
      return normalizedDecimalLiteral{}, false
    }
    if exponentText[0] == '+' || exponentText[0] == '-' {
      if len(exponentText) == 1 {
        return normalizedDecimalLiteral{}, false
      }
    }
    if _, ok := exponent.SetString(exponentText, 10); !ok {
      return normalizedDecimalLiteral{}, false
    }
  }

  decimalPoints := 0
  decimalPoint := -1
  digits := make([]byte, 0, len(coefficientText))
  for index := 0; index < len(coefficientText); index++ {
    char := coefficientText[index]
    if char == '.' {
      decimalPoints++
      decimalPoint = index
      continue
    }
    if char < '0' || char > '9' {
      return normalizedDecimalLiteral{}, false
    }
    digits = append(digits, char)
  }
  if decimalPoints > 1 || len(digits) == 0 {
    return normalizedDecimalLiteral{}, false
  }

  significantDigits := strings.TrimLeft(string(digits), "0")
  if significantDigits == "" {
    return normalizedDecimalLiteral{}, true
  }

  var coefficient string
  var baseMagnitude int
  if decimalPoint < 0 {
    trimmed := strings.TrimLeft(coefficientText, "0")
    coefficient = strings.TrimRight(trimmed, "0")
    baseMagnitude = len(trimmed) - 1
  } else {
    trimmed := strings.TrimLeft(coefficientText, "0")
    point := strings.IndexByte(trimmed, '.')
    if point == 0 {
      coefficient = strings.TrimLeft(trimmed[1:], "0")
      baseMagnitude = len(coefficient) - len(trimmed)
    } else {
      coefficient = strings.ReplaceAll(trimmed, ".", "")
      baseMagnitude = point - 1
    }
  }

  magnitude := new(big.Int).Add(exponent, big.NewInt(int64(baseMagnitude)))
  return normalizedDecimalLiteral{
    coefficient:       coefficient,
    magnitude:         magnitude,
    significantDigits: significantDigits,
  }, true
}

func decimalLiteralValue(significantDigits string, magnitude int) *big.Rat {
  numerator, _ := new(big.Int).SetString(significantDigits, 10)
  scale := magnitude - len(significantDigits) + 1
  if scale >= 0 {
    numerator.Mul(numerator, decimalPower(scale))
    return new(big.Rat).SetInt(numerator)
  }
  return new(big.Rat).SetFrac(numerator, decimalPower(-scale))
}

func roundFloatToDecimalPrecision(value float64, precision int) (string, int) {
  exact := new(big.Rat).SetFloat64(value)
  magnitude := decimalMagnitude(exact, value)
  shift := precision - 1 - magnitude
  numerator := new(big.Int).Set(exact.Num())
  denominator := new(big.Int).Set(exact.Denom())
  if shift >= 0 {
    numerator.Mul(numerator, decimalPower(shift))
  } else {
    denominator.Mul(denominator, decimalPower(-shift))
  }

  quotient, remainder := new(big.Int), new(big.Int)
  quotient.QuoRem(numerator, denominator, remainder)
  if new(big.Int).Lsh(remainder, 1).Cmp(denominator) >= 0 {
    quotient.Add(quotient, big.NewInt(1))
  }

  coefficient := quotient.String()
  if len(coefficient) > precision {
    quotient.Quo(quotient, big.NewInt(10))
    coefficient = quotient.String()
    magnitude++
  }
  if len(coefficient) < precision {
    coefficient = strings.Repeat("0", precision-len(coefficient)) + coefficient
  }
  return coefficient, magnitude
}

func decimalMagnitude(exact *big.Rat, value float64) int {
  magnitude := int(math.Floor(math.Log10(value)))
  for exact.Cmp(decimalPowerRat(magnitude)) < 0 {
    magnitude--
  }
  for exact.Cmp(decimalPowerRat(magnitude+1)) >= 0 {
    magnitude++
  }
  return magnitude
}

func decimalPowerRat(exponent int) *big.Rat {
  if exponent >= 0 {
    return new(big.Rat).SetInt(decimalPower(exponent))
  }
  return new(big.Rat).SetFrac(big.NewInt(1), decimalPower(-exponent))
}

func decimalPower(exponent int) *big.Int {
  return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(exponent)), nil)
}

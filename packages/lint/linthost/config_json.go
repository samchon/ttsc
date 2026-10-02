package linthost

import (
  "bytes"
  "encoding/json"
)

// decodeConfigJSON decodes the config structure while retaining each rule's
// option slots as raw JSON. Rule decoders own option shape and object-entry
// order; converting their objects into maps here would destroy that order.
// Other config fields keep encoding/json's ordinary values for existing
// selector, extends, plugin and format validation. Nonobjects are returned in
// their ordinary shape so the owning config boundary reports its usual error.
// The work and temporary storage scale with supplied JSON bytes and decoded
// config members; the caller owns all returned values and option bytes.
func decodeConfigJSON(raw []byte) (any, error) {
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 || trimmed[0] != '{' {
    var value any
    err := json.Unmarshal(raw, &value)
    return value, err
  }
  var members map[string]json.RawMessage
  if err := json.Unmarshal(raw, &members); err != nil {
    return nil, err
  }
  config := make(map[string]any, len(members))
  for name, member := range members {
    trimmedMember := bytes.TrimSpace(member)
    if name == "rules" && len(trimmedMember) != 0 && trimmedMember[0] == '{' {
      rules, err := decodeConfigRuleEntries(member)
      if err != nil {
        return nil, err
      }
      config[name] = rules
      continue
    }
    var value any
    if err := json.Unmarshal(member, &value); err != nil {
      return nil, err
    }
    config[name] = value
  }
  return config, nil
}

// decodeConfigRuleEntries preserves the entire nested JSON representation of
// every option slot. Severity stays an ordinary scalar and a null option slot
// stays nil, preserving the existing one-slot absence policy. Multiple slots
// still form an array when parseRuleEntry marshals them. This is representation
// preservation for all rule names, not a special path for order-sensitive rules.
func decodeConfigRuleEntries(raw json.RawMessage) (map[string]any, error) {
  var entries map[string]json.RawMessage
  if err := json.Unmarshal(raw, &entries); err != nil {
    return nil, err
  }
  rules := make(map[string]any, len(entries))
  for name, entry := range entries {
    trimmed := bytes.TrimSpace(entry)
    if len(trimmed) == 0 || trimmed[0] != '[' {
      var value any
      if err := json.Unmarshal(entry, &value); err != nil {
        return nil, err
      }
      rules[name] = value
      continue
    }
    var slots []json.RawMessage
    if err := json.Unmarshal(entry, &slots); err != nil {
      return nil, err
    }
    tuple := make([]any, len(slots))
    for index, slot := range slots {
      if index == 0 {
        if err := json.Unmarshal(slot, &tuple[index]); err != nil {
          return nil, err
        }
      } else if !bytes.Equal(bytes.TrimSpace(slot), []byte("null")) {
        tuple[index] = slot
      }
    }
    rules[name] = tuple
  }
  return rules, nil
}

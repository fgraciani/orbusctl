interface ChoiceOption {
  id: string
  description: string
}

interface ChoiceAttribute {
  attributeId: string
  options: Record<string, ChoiceOption>
}

const CHOICE_ATTRIBUTES: Record<string, ChoiceAttribute> = {
  'RASCI': {
    attributeId: '01da5aa6-9347-f111-8ef3-7c1e5252dd1b',
    options: {
      'R': {id: '02da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Responsible'},
      'A': {id: '05da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Accountable'},
      'S': {id: '06da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Support'},
      'C': {id: '04da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Contribute'},
      'I': {id: '03da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Inform'},
    },
  },
  'Access Operator': {
    attributeId: '4ae726ec-e356-ef11-991a-000d3a38a5d9',
    options: {
      'Read':   {id: '4be726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access only reads related element'},
      'Delete': {id: '4ce726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access deletes related element'},
      'Create': {id: '4de726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access creates related element'},
      'Update': {id: '4ee726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access reads and updates related element'},
    },
  },
}

export function resolveChoiceAttribute(attributeName: string): ChoiceAttribute | undefined {
  if (CHOICE_ATTRIBUTES[attributeName]) return CHOICE_ATTRIBUTES[attributeName]
  const lower = attributeName.toLowerCase()
  const match = Object.entries(CHOICE_ATTRIBUTES).find(([k]) => k.toLowerCase() === lower)
  return match ? match[1] : undefined
}

export function resolveChoiceValues(
  attributeName: string,
  values: string[],
): {attributeId: string; choiceValues: Array<{attributeConfigurationChoiceId: string}>} {
  const attr = resolveChoiceAttribute(attributeName)
  if (!attr) {
    const names = Object.keys(CHOICE_ATTRIBUTES).join(', ')
    throw new Error(`Unknown Choice attribute "${attributeName}". Known attributes: ${names}`)
  }

  const choiceValues = values.map((v) => {
    const opt = attr.options[v] ?? Object.entries(attr.options).find(([k]) => k.toLowerCase() === v.toLowerCase())?.[1]
    if (!opt) {
      const valid = Object.keys(attr.options).join(', ')
      throw new Error(`Unknown ${attributeName} value "${v}". Valid values: ${valid}`)
    }
    return {attributeConfigurationChoiceId: opt.id}
  })

  return {attributeId: attr.attributeId, choiceValues}
}

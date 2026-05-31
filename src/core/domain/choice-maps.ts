interface ChoiceOption {
  id: string;
  description: string;
}

interface ChoiceAttribute {
  attributeId: string;
  options: Record<string, ChoiceOption>;
}

const CHOICE_ATTRIBUTES: Record<string, ChoiceAttribute> = {
  'RASCI': {
    attributeId: '01da5aa6-9347-f111-8ef3-7c1e5252dd1b',
    options: {
      'R': { id: '02da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Responsible' },
      'A': { id: '05da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Accountable' },
      'S': { id: '06da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Support' },
      'C': { id: '04da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Contribute' },
      'I': { id: '03da5aa6-9347-f111-8ef3-7c1e5252dd1b', description: 'Inform' },
    },
  },
  'Access Operator': {
    attributeId: '4ae726ec-e356-ef11-991a-000d3a38a5d9',
    options: {
      'Read':   { id: '4be726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access only reads related element' },
      'Delete': { id: '4ce726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access deletes related element' },
      'Create': { id: '4de726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access creates related element' },
      'Update': { id: '4ee726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access reads and updates related element' },
    },
  },
};

export function resolveChoiceAttribute(name: string): ChoiceAttribute | undefined {
  return CHOICE_ATTRIBUTES[name];
}

export function resolveChoiceValues(
  attributeName: string,
  values: string[],
): { attributeConfigurationId: string; choiceValues: Array<{ attributeConfigurationChoiceId: string }> } {
  const attr = CHOICE_ATTRIBUTES[attributeName];
  if (!attr) throw new Error(`Unknown choice attribute: ${attributeName}`);
  const choiceValues = values.map(v => {
    const opt = attr.options[v];
    if (!opt) throw new Error(`Unknown choice value "${v}" for attribute "${attributeName}"`);
    return { attributeConfigurationChoiceId: opt.id };
  });
  return { attributeConfigurationId: attr.attributeId, choiceValues };
}

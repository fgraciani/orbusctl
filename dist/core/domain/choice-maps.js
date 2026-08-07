const CHOICE_ATTRIBUTES = {
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
            'Read': { id: '4be726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access only reads related element' },
            'Delete': { id: '4ce726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access deletes related element' },
            'Create': { id: '4de726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access creates related element' },
            'Update': { id: '4ee726ec-e356-ef11-991a-000d3a38a5d9', description: 'Access reads and updates related element' },
        },
    },
    'Standards Class': {
        attributeId: '3f29a397-2fef-e811-9f2b-00155d26bcf8',
        options: {
            'Non-Standard': { id: '4529a397-2fef-e811-9f2b-00155d26bcf8', description: 'Non-Standard (inferred ID, unconfirmed)' },
            'Proposed Standard': { id: '4629a397-2fef-e811-9f2b-00155d26bcf8', description: 'Proposed Standard (inferred ID, unconfirmed)' },
            'Provisional Standard': { id: '4729a397-2fef-e811-9f2b-00155d26bcf8', description: 'Provisional Standard' },
            'Standard': { id: '4829a397-2fef-e811-9f2b-00155d26bcf8', description: 'Standard' },
            'Phasing-Out Standard': { id: '4929a397-2fef-e811-9f2b-00155d26bcf8', description: 'Phasing-Out Standard' },
            'Retired Standard': { id: '4a29a397-2fef-e811-9f2b-00155d26bcf8', description: 'Retired Standard (inferred ID, unconfirmed)' },
        },
    },
    'Lifecycle Status': {
        attributeId: 'c028a397-2fef-e811-9f2b-00155d26bcf8',
        options: {},
    },
};
export function resolveChoiceAttribute(name) {
    return CHOICE_ATTRIBUTES[name];
}
export function resolveChoiceValues(attributeName, values) {
    const attr = CHOICE_ATTRIBUTES[attributeName];
    if (!attr)
        throw new Error(`Unknown choice attribute: ${attributeName}`);
    const choiceValues = values.map(v => {
        const opt = attr.options[v];
        if (!opt)
            throw new Error(`Unknown choice value "${v}" for attribute "${attributeName}"`);
        return { attributeConfigurationChoiceId: opt.id };
    });
    return { attributeConfigurationId: attr.attributeId, choiceValues };
}

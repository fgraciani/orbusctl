import { resolveChoiceValues } from './choice-maps.js';
export function parseSetFlags(sets) {
    const result = {};
    for (const pair of sets) {
        const eq = pair.indexOf('=');
        if (eq < 1)
            throw new Error(`Invalid --set value "${pair}": expected Key=Value`);
        result[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    return result;
}
export function parseSetChoiceFlags(setChoices) {
    const result = [];
    for (const pair of setChoices) {
        const eq = pair.indexOf('=');
        if (eq < 1)
            throw new Error(`Invalid --set-choice value "${pair}": expected Name=Val1,Val2`);
        const name = pair.slice(0, eq);
        const values = pair.slice(eq + 1).split(',').map(v => v.trim()).filter(Boolean);
        if (values.length === 0)
            throw new Error(`Invalid --set-choice value "${pair}": no values specified`);
        const resolved = resolveChoiceValues(name, values);
        result.push({
            attributeName: name,
            attributeCategory: 'Choice',
            attributeConfigurationId: resolved.attributeConfigurationId,
            choiceValues: resolved.choiceValues,
        });
    }
    return result;
}
export function parseSetDateFlags(setDates) {
    const result = [];
    for (const pair of setDates) {
        const eq = pair.indexOf('=');
        if (eq < 1)
            throw new Error(`Invalid --set-date value "${pair}": expected Name=YYYY-MM-DD`);
        const name = pair.slice(0, eq);
        const raw = pair.slice(eq + 1);
        // Accept YYYY-MM-DD, append T00:00:00Z for API
        const iso = raw.includes('T') ? raw : `${raw}T00:00:00Z`;
        result.push({
            attributeName: name,
            attributeCategory: 'DateTime',
            dateTimeValue: iso,
        });
    }
    return result;
}
export function buildMixedAttributeValues(sets, setChoices, setDates = []) {
    const result = [];
    for (const pair of sets) {
        const eq = pair.indexOf('=');
        if (eq < 1)
            throw new Error(`Invalid --set value "${pair}": expected Key=Value`);
        result.push({
            attributeName: pair.slice(0, eq),
            attributeCategory: 'Text',
            textValue: { plainText: pair.slice(eq + 1), richText: null },
        });
    }
    result.push(...parseSetChoiceFlags(setChoices));
    result.push(...parseSetDateFlags(setDates));
    return result;
}

import { resolveChoiceValues } from './choice-maps.js';

export interface ParsedAttribute {
  attributeName: string;
  attributeCategory: 'Text' | 'Choice';
  textValue?: { plainText: string; richText: null };
  choiceValues?: Array<{ attributeConfigurationChoiceId: string }>;
  attributeConfigurationId?: string;
}

export function parseSetFlags(sets: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of sets) {
    const eq = pair.indexOf('=');
    if (eq < 1) throw new Error(`Invalid --set value "${pair}": expected Key=Value`);
    result[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return result;
}

export function parseSetChoiceFlags(setChoices: string[]): ParsedAttribute[] {
  const result: ParsedAttribute[] = [];
  for (const pair of setChoices) {
    const eq = pair.indexOf('=');
    if (eq < 1) throw new Error(`Invalid --set-choice value "${pair}": expected Name=Val1,Val2`);
    const name = pair.slice(0, eq);
    const values = pair.slice(eq + 1).split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) throw new Error(`Invalid --set-choice value "${pair}": no values specified`);
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

export function buildMixedAttributeValues(sets: string[], setChoices: string[]): ParsedAttribute[] {
  const result: ParsedAttribute[] = [];

  for (const pair of sets) {
    const eq = pair.indexOf('=');
    if (eq < 1) throw new Error(`Invalid --set value "${pair}": expected Key=Value`);
    result.push({
      attributeName: pair.slice(0, eq),
      attributeCategory: 'Text',
      textValue: { plainText: pair.slice(eq + 1), richText: null },
    });
  }

  result.push(...parseSetChoiceFlags(setChoices));
  return result;
}

export type ArchiMateLayer =
  | 'business'
  | 'application'
  | 'technology'
  | 'physical'
  | 'strategy'
  | 'motivation'
  | 'implementation'
  | 'other';

const TYPE_LAYER: Record<string, ArchiMateLayer> = {
  'Business actor': 'business',
  'Business collaboration': 'business',
  'Business event': 'business',
  'Business function': 'business',
  'Business interaction': 'business',
  'Business interface': 'business',
  'Business object': 'business',
  'Business process': 'business',
  'Business role': 'business',
  'Business service': 'business',
  'Contract': 'business',
  'Product': 'business',
  'Representation': 'business',

  'Application collaboration': 'application',
  'Application component': 'application',
  'Application event': 'application',
  'Application function': 'application',
  'Application interaction': 'application',
  'Application interface': 'application',
  'Application process': 'application',
  'Application service': 'application',
  'Data object': 'application',

  'Artifact': 'technology',
  'Communication network': 'technology',
  'Device': 'technology',
  'Node': 'technology',
  'Path': 'technology',
  'System software': 'technology',
  'Technology collaboration': 'technology',
  'Technology event': 'technology',
  'Technology function': 'technology',
  'Technology interaction': 'technology',
  'Technology interface': 'technology',
  'Technology process': 'technology',
  'Technology service': 'technology',

  'Distribution network': 'physical',
  'Equipment': 'physical',
  'Facility': 'physical',
  'Material': 'physical',

  'Capability': 'strategy',
  'Course of action': 'strategy',
  'Resource': 'strategy',
  'Value stream': 'strategy',

  'Assessment': 'motivation',
  'Constraint': 'motivation',
  'Driver': 'motivation',
  'Goal': 'motivation',
  'Meaning': 'motivation',
  'Outcome': 'motivation',
  'Principle': 'motivation',
  'Requirement': 'motivation',
  'Stakeholder': 'motivation',
  'Value': 'motivation',

  'Deliverable': 'implementation',
  'Gap': 'implementation',
  'Implementation event': 'implementation',
  'Plateau': 'implementation',
  'Work package': 'implementation',

  'Grouping': 'other',
  'Junction': 'other',
  'Location': 'other',
};

export const LAYER_INK_COLOR: Record<ArchiMateLayer, string> = {
  business: 'yellow',
  application: 'cyan',
  technology: 'green',
  physical: 'greenBright',
  strategy: 'yellowBright',
  motivation: 'magenta',
  implementation: 'red',
  other: 'gray',
};

export function getTypeLayer(typeName: string): ArchiMateLayer {
  return TYPE_LAYER[typeName.trim()] ?? 'other';
}

export function getTypeInkColor(typeName: string): string {
  return LAYER_INK_COLOR[getTypeLayer(typeName)];
}

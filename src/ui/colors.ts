const RESET = '\x1b[0m'
const YELLOW = '\x1b[33m'
const BRIGHT_YELLOW = '\x1b[93m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const BRIGHT_GREEN = '\x1b[92m'
const MAGENTA = '\x1b[35m'
const RED = '\x1b[31m'
const DIM = '\x1b[90m'

const TYPE_COLORS: Record<string, string> = {
  'Business actor': YELLOW,
  'Business collaboration': YELLOW,
  'Business event': YELLOW,
  'Business function': YELLOW,
  'Business interaction': YELLOW,
  'Business interface': YELLOW,
  'Business object': YELLOW,
  'Business process': YELLOW,
  'Business role': YELLOW,
  'Business service': YELLOW,
  'Contract': YELLOW,
  'Product': YELLOW,
  'Representation': YELLOW,

  'Application collaboration': CYAN,
  'Application component': CYAN,
  'Application event': CYAN,
  'Application function': CYAN,
  'Application interaction': CYAN,
  'Application interface': CYAN,
  'Application process': CYAN,
  'Application service': CYAN,
  'Data object': CYAN,

  'Artifact': GREEN,
  'Communication network': GREEN,
  'Device': GREEN,
  'Node': GREEN,
  'Path': GREEN,
  'System software': GREEN,
  'Technology collaboration': GREEN,
  'Technology event': GREEN,
  'Technology function': GREEN,
  'Technology interaction': GREEN,
  'Technology interface': GREEN,
  'Technology process': GREEN,
  'Technology service': GREEN,

  'Distribution network': BRIGHT_GREEN,
  'Equipment': BRIGHT_GREEN,
  'Facility': BRIGHT_GREEN,
  'Material': BRIGHT_GREEN,

  'Capability': BRIGHT_YELLOW,
  'Course of action': BRIGHT_YELLOW,
  'Resource': BRIGHT_YELLOW,
  'Value stream': BRIGHT_YELLOW,

  'Assessment': MAGENTA,
  'Constraint': MAGENTA,
  'Driver': MAGENTA,
  'Goal': MAGENTA,
  'Meaning': MAGENTA,
  'Outcome': MAGENTA,
  'Principle': MAGENTA,
  'Requirement': MAGENTA,
  'Stakeholder': MAGENTA,
  'Value': MAGENTA,

  'Deliverable': RED,
  'Gap': RED,
  'Implementation event': RED,
  'Plateau': RED,
  'Work package': RED,

  'Grouping': DIM,
  'Junction': DIM,
  'Location': DIM,
}

export function colorType(typeName: string): string {
  const color = TYPE_COLORS[typeName.trim()]
  if (!color) return typeName
  return `${color}${typeName}${RESET}`
}

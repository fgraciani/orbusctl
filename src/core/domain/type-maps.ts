const OBJECT_TYPES: Record<string, string> = {
  'Application collaboration': 'f1d6af8c-5e52-ea11-a94c-28187852a561',
  'Application component': '6fb624e4-b642-ea11-a601-28187852aafd',
  'Application event': 'd8d6af8c-5e52-ea11-a94c-28187852a561',
  'Application function': '7cb624e4-b642-ea11-a601-28187852aafd',
  'Application interaction': 'fed6af8c-5e52-ea11-a94c-28187852a561',
  'Application interface': 'a3b624e4-b642-ea11-a601-28187852aafd',
  'Application process': '66d7af8c-5e52-ea11-a94c-28187852a561',
  'Application service': '59d7af8c-5e52-ea11-a94c-28187852a561',
  'Artifact': '0bd7af8c-5e52-ea11-a94c-28187852a561',
  'Assessment': '18d7af8c-5e52-ea11-a94c-28187852a561',
  'Business actor': '445f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Business collaboration': 'b0b624e4-b642-ea11-a601-28187852aafd',
  'Business event': '805f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Business function': '8f5f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Business interaction': '3fd7af8c-5e52-ea11-a94c-28187852a561',
  'Business interface': '40d7af8c-5e52-ea11-a94c-28187852a561',
  'Business object': '625f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Business process': '7f395db8-2eef-e811-9f2b-00155d26bcf8',
  'Business role': '243a5db8-2eef-e811-9f2b-00155d26bcf8',
  'Business service': '73d7af8c-5e52-ea11-a94c-28187852a561',
  'Capability': '265f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Communication network': '80d7af8c-5e52-ea11-a94c-28187852a561',
  'Constraint': '535f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Contract': '085f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Course of action': 'd3606dbe-2eef-e811-9f2b-00155d26bcf8',
  'Data object': '9ad7af8c-5e52-ea11-a94c-28187852a561',
  'Deliverable': 'a7d7af8c-5e52-ea11-a94c-28187852a561',
  'Device': 'b4d7af8c-5e52-ea11-a94c-28187852a561',
  'Distribution network': 'c1d7af8c-5e52-ea11-a94c-28187852a561',
  'Driver': '715f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Equipment': 'ced7af8c-5e52-ea11-a94c-28187852a561',
  'Facility': 'dbd7af8c-5e52-ea11-a94c-28187852a561',
  'Gap': '9e5f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Goal': 'ad5f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Grouping': 'e8d7af8c-5e52-ea11-a94c-28187852a561',
  'Implementation event': 'f6d7af8c-5e52-ea11-a94c-28187852a561',
  'Junction': 'd7d6af8c-5e52-ea11-a94c-28187852a561',
  'Location': 'cb5f5bb2-2eef-e811-9f2b-00155d26bcf8',
  'Material': 'f5d7af8c-5e52-ea11-a94c-28187852a561',
  'Meaning': '18d8af8c-5e52-ea11-a94c-28187852a561',
  'Node': '140714ec-b642-ea11-a601-28187852aafd',
  'Outcome': '16605bb2-2eef-e811-9f2b-00155d26bcf8',
  'Path': '29d8af8c-5e52-ea11-a94c-28187852a561',
  'Plateau': '36d8af8c-5e52-ea11-a94c-28187852a561',
  'Principle': '70395db8-2eef-e811-9f2b-00155d26bcf8',
  'Product': '8e395db8-2eef-e811-9f2b-00155d26bcf8',
  'Representation': '50d8af8c-5e52-ea11-a94c-28187852a561',
  'Requirement': '9d395db8-2eef-e811-9f2b-00155d26bcf8',
  'Resource': '5dd8af8c-5e52-ea11-a94c-28187852a561',
  'Stakeholder': '0e7bc276-9015-ee11-a9bb-002248845c45',
  'System software': '77d8af8c-5e52-ea11-a94c-28187852a561',
  'Technology collaboration': '84d8af8c-5e52-ea11-a94c-28187852a561',
  'Technology event': '91d8af8c-5e52-ea11-a94c-28187852a561',
  'Technology function': '070714ec-b642-ea11-a601-28187852aafd',
  'Technology interaction': '9ed8af8c-5e52-ea11-a94c-28187852a561',
  'Technology interface': 'abd8af8c-5e52-ea11-a94c-28187852a561',
  'Technology process': 'b8d8af8c-5e52-ea11-a94c-28187852a561',
  'Technology service': '52395db8-2eef-e811-9f2b-00155d26bcf8',
  'Value': 'c77daa92-5e52-ea11-a94c-28187852a561',
  'Value stream': '74eb7fc4-2eef-e811-9f2b-00155d26bcf8',
  'Work package': 'bdb624e4-b642-ea11-a601-28187852aafd',
}

const RELATIONSHIP_TYPES: Record<string, string> = {
  'ArchiMate: Access': '6dbe23c3-7da7-eb11-b566-0050f25a1236',
  'ArchiMate: Aggregation': '969059e5-7da7-eb11-b566-0050f25a1236',
  'ArchiMate: Assignment': '319179f7-7da7-eb11-b566-0050f25a1236',
  'ArchiMate: Association': '2e0a721b-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Composition': '3e28b307-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Flow': 'c6b6422b-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Influence': 'f77b0a3d-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Realization': 'd2be4c4e-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Serving': '7aa47a5b-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Specialization': '0533e072-7ea7-eb11-b566-0050f25a1236',
  'ArchiMate: Triggering': 'ed2c1289-7ea7-eb11-b566-0050f25a1236',
}

function resolve(map: Record<string, string>, name: string, label: string): string {
  if (map[name]) return map[name]

  const lower = name.toLowerCase()
  const match = Object.entries(map).find(([k]) => k.toLowerCase() === lower)
  if (match) return match[1]

  const names = Object.keys(map).join(', ')
  throw new Error(`Unknown ${label} "${name}". Valid types: ${names}`)
}

export function resolveObjectTypeId(name: string): string {
  return resolve(OBJECT_TYPES, name, 'object type')
}

export function resolveRelationshipTypeId(name: string): string {
  return resolve(RELATIONSHIP_TYPES, name, 'relationship type')
}

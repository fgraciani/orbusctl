import {Model, ModelCounts} from '../api'

interface TreeNode {
  model: Model
  children: TreeNode[]
}

function buildTree(models: Model[]): TreeNode[] {
  const modelIds = new Set(models.map((m) => m.ModelId))
  const childrenMap = new Map<string | null, Model[]>()

  for (const model of models) {
    const parentId = model.BaselineModelId && modelIds.has(model.BaselineModelId)
      ? model.BaselineModelId
      : null
    const siblings = childrenMap.get(parentId) ?? []
    siblings.push(model)
    childrenMap.set(parentId, siblings)
  }

  function toNodes(parentId: string | null): TreeNode[] {
    const children = childrenMap.get(parentId) ?? []
    children.sort((a, b) => a.Name.localeCompare(b.Name))
    return children.map((model) => ({
      model,
      children: toNodes(model.ModelId),
    }))
  }

  return toNodes(null)
}

export interface ModelChoice {
  name: string
  value: Model
}

export function buildModelChoices(models: Model[]): ModelChoice[] {
  const choices: ModelChoice[] = []
  const tree = buildTree(models)

  function walk(nodes: TreeNode[], prefix: string, isRoot: boolean): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const isLast = i === nodes.length - 1
      const connector = isRoot ? '' : (isLast ? '└── ' : '├── ')
      choices.push({name: `${prefix}${connector}${node.model.Name}`, value: node.model})

      if (node.children.length > 0) {
        const childPrefix = isRoot ? prefix : prefix + (isLast ? '    ' : '│   ')
        walk(node.children, childPrefix, false)
      }
    }
  }

  walk(tree, '', true)
  return choices
}

export function formatModelTree(models: Model[], detailCounts?: Map<string, ModelCounts>): string[] {
  const lines: string[] = []
  const tree = buildTree(models)

  function formatLabel(model: Model): string {
    let label = model.Name
    if (detailCounts) {
      const counts = detailCounts.get(model.ModelId)
      if (counts) {
        label += ` (${counts.objects} objects, ${counts.relationships} relationships, ${counts.drawings} drawings)`
      }
    }

    if (model.IsHidden) {
      label += ' (deactivated)'
    }

    return label
  }

  function walk(nodes: TreeNode[], prefix: string, isRoot: boolean): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const isLast = i === nodes.length - 1
      const connector = isRoot ? '' : (isLast ? '└── ' : '├── ')
      lines.push(`${prefix}${connector}${formatLabel(node.model)}`)

      if (node.children.length > 0) {
        const childPrefix = isRoot ? prefix : prefix + (isLast ? '    ' : '│   ')
        walk(node.children, childPrefix, false)
      }
    }
  }

  walk(tree, '    ', true)
  return lines
}

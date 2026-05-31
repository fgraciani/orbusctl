import type { Model } from '../api/models.js';

export interface TreeNode {
  model: Model;
  children: TreeNode[];
}

export function buildTree(models: Model[]): TreeNode[] {
  const modelIds = new Set(models.map((m) => m.ModelId));
  const childrenMap = new Map<string | null, Model[]>();

  for (const model of models) {
    const parentId = model.BaselineModelId && modelIds.has(model.BaselineModelId)
      ? model.BaselineModelId
      : null;
    const siblings = childrenMap.get(parentId) ?? [];
    siblings.push(model);
    childrenMap.set(parentId, siblings);
  }

  function toNodes(parentId: string | null): TreeNode[] {
    const children = childrenMap.get(parentId) ?? [];
    children.sort((a, b) => a.Name.localeCompare(b.Name));
    return children.map((model) => ({
      model,
      children: toNodes(model.ModelId),
    }));
  }

  return toNodes(null);
}

export function flattenTree(nodes: TreeNode[], depth = 0): Array<{ model: Model; depth: number; isLast: boolean; ancestors: boolean[] }> {
  const result: Array<{ model: Model; depth: number; isLast: boolean; ancestors: boolean[] }> = [];

  function walk(items: TreeNode[], d: number, ancestorIsLast: boolean[]): void {
    for (let i = 0; i < items.length; i++) {
      const isLast = i === items.length - 1;
      result.push({ model: items[i].model, depth: d, isLast, ancestors: ancestorIsLast });
      if (items[i].children.length > 0) {
        walk(items[i].children, d + 1, [...ancestorIsLast, isLast]);
      }
    }
  }

  walk(nodes, depth, []);
  return result;
}

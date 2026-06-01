export function buildTree(models) {
    const modelIds = new Set(models.map((m) => m.ModelId));
    const childrenMap = new Map();
    for (const model of models) {
        const parentId = model.BaselineModelId && modelIds.has(model.BaselineModelId)
            ? model.BaselineModelId
            : null;
        const siblings = childrenMap.get(parentId) ?? [];
        siblings.push(model);
        childrenMap.set(parentId, siblings);
    }
    function toNodes(parentId) {
        const children = childrenMap.get(parentId) ?? [];
        children.sort((a, b) => a.Name.localeCompare(b.Name));
        return children.map((model) => ({
            model,
            children: toNodes(model.ModelId),
        }));
    }
    return toNodes(null);
}
export function flattenTree(nodes, depth = 0) {
    const result = [];
    function walk(items, d, ancestorIsLast) {
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

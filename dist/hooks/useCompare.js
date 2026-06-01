import { useState, useEffect } from 'react';
import { fetchObjects } from '../core/api/objects.js';
function buildCompareRows(leftObjects, rightObjects) {
    const rightMap = new Map();
    for (const obj of rightObjects) {
        rightMap.set(`${obj.Name}::${obj.ObjectType.Name}`, obj);
    }
    const rows = [];
    const matchedRight = new Set();
    // Sort left objects by type + name
    const sortedLeft = [...leftObjects].sort((a, b) => a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name));
    for (const left of sortedLeft) {
        const key = `${left.Name}::${left.ObjectType.Name}`;
        const right = rightMap.get(key);
        if (right) {
            rows.push({ left, right, match: 'both' });
            matchedRight.add(key);
        }
        else {
            rows.push({ left, right: null, match: 'left-only' });
        }
    }
    // Add right-only objects
    const rightOnly = rightObjects
        .filter(obj => !matchedRight.has(`${obj.Name}::${obj.ObjectType.Name}`))
        .sort((a, b) => a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name));
    for (const right of rightOnly) {
        rows.push({ left: null, right, match: 'right-only' });
    }
    // Re-sort: matched objects by type+name, then left-only, then right-only
    // Actually, interleave them sorted by the available name so the diff reads naturally
    rows.sort((a, b) => {
        const aName = (a.left ?? a.right);
        const bName = (b.left ?? b.right);
        return aName.ObjectType.Name.localeCompare(bName.ObjectType.Name) || aName.Name.localeCompare(bName.Name);
    });
    return rows;
}
export function useCompare(token, modelAId, modelBId) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!token || !modelAId || !modelBId) {
            setRows([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([
            fetchObjects(token, modelAId),
            fetchObjects(token, modelBId),
        ]).then(([leftObjs, rightObjs]) => {
            if (!cancelled) {
                setRows(buildCompareRows(leftObjs, rightObjs));
            }
        }).catch(e => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Compare failed');
        }).finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
    }, [token, modelAId, modelBId]);
    const bothCount = rows.filter(r => r.match === 'both').length;
    const leftOnlyCount = rows.filter(r => r.match === 'left-only').length;
    const rightOnlyCount = rows.filter(r => r.match === 'right-only').length;
    return { rows, loading, error, leftCount: bothCount + leftOnlyCount, rightCount: bothCount + rightOnlyCount, bothCount, leftOnlyCount, rightOnlyCount };
}

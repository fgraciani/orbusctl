export function formatOutput(data, json, humanFormatter) {
    if (json) {
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    }
    else {
        humanFormatter(data);
    }
}
export function treePrefix(depth, isLast, ancestors) {
    let prefix = '';
    for (let i = 0; i < depth; i++) {
        prefix += ancestors[i] ? '    ' : '│   ';
    }
    prefix += isLast ? '└── ' : '├── ';
    return prefix;
}

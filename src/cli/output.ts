export function formatOutput<T>(data: T, json: boolean, humanFormatter: (data: T) => void): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    humanFormatter(data);
  }
}

export function treePrefix(depth: number, isLast: boolean, ancestors: boolean[]): string {
  let prefix = '';
  for (let i = 0; i < depth; i++) {
    prefix += ancestors[i] ? '    ' : '│   ';
  }
  prefix += isLast ? '└── ' : '├── ';
  return prefix;
}

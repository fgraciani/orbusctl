import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const REMOTE_PACKAGE_URL = 'https://raw.githubusercontent.com/fgraciani/orbusctl/main/package.json'

export function getLocalVersion(): string {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
  return pkg.version
}

export async function checkForUpdate(): Promise<string | null> {
  try {
    const response = await fetch(REMOTE_PACKAGE_URL)
    if (!response.ok) return null
    const pkg = (await response.json()) as {version: string}
    return pkg.version
  } catch {
    return null
  }
}

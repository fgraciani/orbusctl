import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

const CONFIG_DIR = join(homedir(), '.orbusctl')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const REPORTS_DIR = join(CONFIG_DIR, 'reports')

export interface UserInfo {
  name: string
  accountName: string
  emailAddress: string
}

const DEFAULT_SOLUTION_FILTER = 'ArchiMate 3.1'

interface Config {
  showHiddenModels?: boolean
  solutionFilter?: string
  token?: string
  user?: UserInfo
}

function readConfig(): Config {
  if (!existsSync(CONFIG_FILE)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Config
  } catch {
    return {}
  }
}

function writeConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
}

export function getToken(): string | undefined {
  return process.env.ORBUS_TOKEN ?? readConfig().token
}

export function getUser(): UserInfo | undefined {
  return readConfig().user
}

export function getShowHiddenModels(): boolean {
  return readConfig().showHiddenModels ?? false
}

export function saveShowHiddenModels(show: boolean): void {
  const config = readConfig()
  config.showHiddenModels = show
  writeConfig(config)
}

export function getSolutionFilter(): string | undefined {
  const value = readConfig().solutionFilter
  if (value === '') return undefined
  return value ?? DEFAULT_SOLUTION_FILTER
}

export function saveSolutionFilter(solutionFilter: string | undefined): void {
  const config = readConfig()
  config.solutionFilter = solutionFilter ?? ''
  writeConfig(config)
}

export function resetSettings(): void {
  const config = readConfig()
  delete config.showHiddenModels
  delete config.solutionFilter
  writeConfig(config)
}

export function saveAuth(token: string, user: UserInfo): void {
  const config = readConfig()
  config.token = token
  config.user = user
  writeConfig(config)
}

export function getReportsDir(): string {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, {recursive: true})
  }
  return REPORTS_DIR
}

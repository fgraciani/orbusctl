import {writeFileSync} from 'node:fs'
import {scryptSync, timingSafeEqual} from 'node:crypto'
import {join} from 'node:path'

import {input, password, select} from '@inquirer/prompts'
import {Command} from '@oclif/core'

import {type ActivityObject, type ActivityRelationship, type Model, fetchMe, fetchModelDetailCounts, fetchModels, fetchObjectDetail, fetchObjectModelName, fetchObjectRelationships, fetchObjects, fetchRecentObjects, fetchRecentRelationships, fetchSolutions} from '../api'
import {getReportsDir, getShowHiddenModels, getSolutionFilter, getToken, getUser, resetSettings, saveAuth, saveShowHiddenModels, saveSolutionFilter} from '../config'
import {type ActivityReport, buildModelActivityChoices, formatActivityReportMarkdown, formatActivitySummary, formatModelActivity} from '../ui/activity'
import {banner} from '../ui/banner'
import {colorType} from '../ui/colors'
import {mainMenu} from '../ui/menu'
import {formatObjectDetail} from '../ui/table'
import {buildModelChoices, formatModelTree} from '../ui/tree'
import {checkForUpdate, getLocalVersion} from '../update'

const ADMIN_SALT = '8c4c4904a54b3b7b841d1e2e36761208'
const ADMIN_HASH = 'fdbddc27e1c36f54a6835448acea75f13ffe696df0e77e5fca23638042e9689c5333b724c23e6cb91d15cf2e23685f46324d79578ed48c8b3d9b12f2c703b56d'

function verifyAdmin(password: string): boolean {
  const hash = scryptSync(password, ADMIN_SALT, 64)
  return timingSafeEqual(hash, Buffer.from(ADMIN_HASH, 'hex'))
}

export default class Index extends Command {
  static description = 'Orbus Administration CLI'

  async promptForToken(): Promise<boolean> {
    const token = await input({message: 'Enter your bearer token:'})
    this.log()
    this.log('  Validating token...')

    try {
      const me = await fetchMe(token)
      saveAuth(token, {
        name: me.Name,
        accountName: me.AccountName,
        emailAddress: me.EmailAddress,
      })
      this.log(`  Authenticated as ${me.Name} (${me.EmailAddress}).`)
      this.log(`  Token saved to ~/.orbusctl/config.json.`)
      this.log()
      return true
    } catch {
      this.log('  Token validation failed. Token was not saved.')
      this.log()
      return false
    }
  }

  async run(): Promise<void> {
    await this.parse(Index)
    this.log(banner)
    this.log()
    this.log('  Orbus Administration CLI - by francisco.graciani')
    this.log()

    const local = getLocalVersion()
    const remote = await checkForUpdate()
    if (remote && remote !== local) {
      this.log(`  Update available: v${local} → v${remote}`)
      this.log('  Run: npm install -g github:fgraciani/orbusctl')
      this.log()
    }

    const savedToken = getToken()
    const savedUser = getUser()

    if (savedToken) {
      if (savedUser) {
        this.log(`  Welcome back, ${savedUser.name}.`)
      }

      this.log('  Validating token...')

      try {
        const me = await fetchMe(savedToken)
        if (savedUser) {
          this.log('  Token is valid.')
        } else {
          this.log(`  Authenticated as ${me.Name} (${me.EmailAddress}).`)
        }

      } catch {
        this.log('  Token expired or invalid.')
        await this.promptForToken()
      }

      this.log()
    }

    for (;;) {
      const choice = await mainMenu()

      switch (choice) {
        case 'models': {
          const token = getToken()
          if (!token) {
            this.log()
            this.log('  No token configured. Please set an authentication token first.')
            this.log()
            break
          }

          const filter = getSolutionFilter()
          this.log()
          if (filter) {
            this.log(`  Fetching models (filtered by "${filter}")...`)
          } else {
            this.log('  Fetching all models...')
          }

          try {
            const allModels = await fetchModels(token, filter)
            const showHidden = getShowHiddenModels()
            const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)
            const hiddenCount = allModels.length - models.length
            this.log(`  Found ${models.length} model(s).${hiddenCount > 0 ? ` (${hiddenCount} deactivated hidden)` : ''}`)
            this.log()

            for (const line of formatModelTree(models)) {
              this.log(line)
            }

            this.log()
          } catch {
            this.log('  Failed to fetch models. Token may have expired.')
            this.log()
          }

          break
        }

        case 'models-detail': {
          const token = getToken()
          if (!token) {
            this.log()
            this.log('  No token configured. Please set an authentication token first.')
            this.log()
            break
          }

          const filter = getSolutionFilter()
          this.log()
          if (filter) {
            this.log(`  Fetching models (filtered by "${filter}")...`)
          } else {
            this.log('  Fetching all models...')
          }

          try {
            const allModels = await fetchModels(token, filter)
            const showHidden = getShowHiddenModels()
            const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)
            const hiddenCount = allModels.length - models.length
            this.log(`  Found ${models.length} model(s).${hiddenCount > 0 ? ` (${hiddenCount} deactivated hidden)` : ''}`)
            this.log('  Fetching object and relationship counts...')

            const counts = await fetchModelDetailCounts(token, models.map((m) => m.ModelId))
            this.log()

            for (const line of formatModelTree(models, counts)) {
              this.log(line)
            }

            this.log()
          } catch {
            this.log('  Failed to fetch models. Token may have expired.')
            this.log()
          }

          break
        }

        case 'objects': {
          const token = getToken()
          if (!token) {
            this.log()
            this.log('  No token configured. Please set an authentication token first.')
            this.log()
            break
          }

          const filter = getSolutionFilter()
          this.log()
          this.log('  Fetching models...')

          try {
            const allModels = await fetchModels(token, filter)
            const showHidden = getShowHiddenModels()
            const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)

            const model = await select<Model | null>({
              message: 'Select a model:',
              choices: [
                {name: '← Back to menu', value: null},
                ...buildModelChoices(models),
              ],
              pageSize: 20,
            })

            if (!model) break

            this.log()
            this.log(`  Fetching objects for "${model.Name}"...`)

            const objects = await fetchObjects(token, model.ModelId)
            this.log(`  Found ${objects.length} object(s).`)
            this.log()

            const sorted = [...objects].sort((a, b) =>
              a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name),
            )
            const maxName = Math.max(...sorted.map((o) => o.Name.length))
            const maxType = Math.max(...sorted.map((o) => o.ObjectType.Name.length))
            const maxModBy = Math.max(...sorted.map((o) => o.LastModifiedBy.Name.length))
            const objectChoices = [
              {name: '← Back to menu', value: ''},
              ...sorted.map((o) => {
                const date = new Date(o.LastModifiedDate).toLocaleDateString('en-GB')
                return {
                  name: `${o.Name.padEnd(maxName)}   ${colorType(o.ObjectType.Name.padEnd(maxType))}   ${o.LastModifiedBy.Name.padEnd(maxModBy)}   ${date}`,
                  value: o.ObjectId,
                }
              }),
            ]

            let lastPicked = ''
            for (;;) {
              const picked = await select({
                message: 'Select an object for details (or go back):',
                choices: objectChoices,
                default: lastPicked || undefined,
                pageSize: 20,
              })

              if (!picked) break
              lastPicked = picked

              this.log()
              this.log('  Fetching object details...')

              const [detail, relationships] = await Promise.all([
                fetchObjectDetail(token, picked),
                fetchObjectRelationships(token, picked),
              ])

              let originalModelName: string | null = null
              if (detail.Detail.Status !== 'Original' && detail.Detail.OriginalObjectId) {
                originalModelName = await fetchObjectModelName(token, detail.Detail.OriginalObjectId)
              }

              this.log()

              for (const line of formatObjectDetail(detail, originalModelName, relationships)) {
                this.log(line)
              }

              this.log()
            }
          } catch {
            this.log('  Failed to fetch objects. Token may have expired.')
            this.log()
          }

          break
        }

        case 'activity': {
          const token = getToken()
          if (!token) {
            this.log()
            this.log('  No token configured. Please set an authentication token first.')
            this.log()
            break
          }

          const pw = await password({message: 'Admin password:', mask: '*'})
          if (!verifyAdmin(pw)) {
            this.log()
            this.log('  Access denied.')
            this.log()
            break
          }

          const period = await select({
            message: 'Select time period:',
            choices: [
              {name: 'Last 24 hours', value: 24},
              {name: 'Last 7 days', value: 7 * 24},
              {name: 'Last 30 days', value: 30 * 24},
              {name: '← Back to menu', value: 0},
            ],
          })

          if (period === 0) break

          const now = new Date()
          const since = new Date(now.getTime() - period * 60 * 60 * 1000)
          const label = period === 24 ? 'last 24 hours' : period === 7 * 24 ? 'last 7 days' : 'last 30 days'

          const filter = getSolutionFilter()
          this.log()
          if (filter) {
            this.log(`  Fetching models (filtered by "${filter}")...`)
          } else {
            this.log('  Fetching all models...')
          }

          try {
            const allModels = await fetchModels(token, filter)
            const showHidden = getShowHiddenModels()
            const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)
            this.log(`  Found ${models.length} model(s). Scanning activity...`)

            const objectsByModel = new Map<string, ActivityObject[]>()
            const relationshipsByModel = new Map<string, ActivityRelationship[]>()

            for (const model of models) {
              try {
                const [objects, relationships] = await Promise.all([
                  fetchRecentObjects(token, model.ModelId, since.toISOString()),
                  fetchRecentRelationships(token, model.ModelId, since.toISOString()),
                ])

                if (objects.length > 0) objectsByModel.set(model.ModelId, objects)
                if (relationships.length > 0) relationshipsByModel.set(model.ModelId, relationships)

                const total = objects.length + relationships.length
                if (total > 0) {
                  this.log(`  ${model.Name}: ${objects.length} object(s), ${relationships.length} relationship(s)`)
                }
              } catch (error) {
                if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
                  this.log('  Token expired mid-scan. Showing partial results.')
                  break
                }
                this.log(`  Failed to scan "${model.Name}".`)
              }
            }

            const report: ActivityReport = {label, models, objectsByModel, relationshipsByModel, since, until: now}

            for (const line of formatActivitySummary(report)) {
              this.log(line)
            }

            const md = formatActivityReportMarkdown(report)
            const datePart = now.toISOString().slice(0, 10)
            const windowPart = period === 24 ? '24h' : period === 7 * 24 ? '7d' : '30d'
            const fileName = `activity_${datePart}_${windowPart}.md`
            const filePath = join(getReportsDir(), fileName)
            writeFileSync(filePath, md)
            this.log(`  Report saved to ${filePath}`)
            this.log()

            const modelChoices = buildModelActivityChoices(report)
            if (modelChoices.length > 0) {
              for (;;) {
                const picked = await select({
                  message: 'Inspect a model (or go back):',
                  choices: [
                    {name: '← Back to menu', value: ''},
                    ...modelChoices,
                  ],
                  pageSize: 20,
                })

                if (!picked) break

                for (const line of formatModelActivity(report, picked)) {
                  this.log(line)
                }
              }
            }
          } catch {
            this.log('  Failed to generate activity report. Token may have expired.')
            this.log()
          }

          break
        }

        case 'config': {
          const token = getToken()
          const user = getUser()
          const filter = getSolutionFilter()
          const showHidden = getShowHiddenModels()

          this.log()
          this.log('  Current configuration:')
          this.log()
          this.log(`    User:            ${user ? `${user.name} (${user.emailAddress})` : 'Not authenticated'}`)
          this.log(`    Token:           ${token ? `${token.slice(0, 20)}... (${token.length} chars)` : 'Not set'}`)
          this.log(`    Solution filter: ${filter ?? 'None (showing all models)'}`)
          this.log(`    Hidden models:   ${showHidden ? 'Shown' : 'Hidden'}`)
          this.log()

          const action = await select({
            message: 'What would you like to change?',
            choices: [
              {name: 'Set authentication token', value: 'auth' as const},
              {name: 'Select a solution filter', value: 'change' as const},
              {name: 'Clear solution filter (show all models)', value: 'clear' as const},
              {name: `${showHidden ? 'Hide' : 'Show'} deactivated models`, value: 'toggle-hidden' as const},
              {name: 'Reset to defaults', value: 'reset' as const},
              {name: 'Back to menu', value: 'back' as const},
            ],
          })

          if (action === 'back') break

          if (action === 'auth') {
            await this.promptForToken()
            break
          }

          if (action === 'toggle-hidden') {
            saveShowHiddenModels(!showHidden)
            this.log()
            this.log(`  Deactivated models will now be ${showHidden ? 'hidden' : 'shown'}.`)
            this.log()
            break
          }

          if (action === 'reset') {
            resetSettings()
            this.log()
            this.log('  Settings reset to defaults (solution filter: ArchiMate 3.1, hidden models: hidden).')
            this.log()
            break
          }

          if (action === 'clear') {
            saveSolutionFilter(undefined)
            this.log()
            this.log('  Solution filter cleared. All models will be shown.')
            this.log()
            break
          }

          if (!token) {
            this.log()
            this.log('  Authenticate first to change the solution filter.')
            this.log()
            break
          }

          this.log()
          this.log('  Fetching solutions...')

          try {
            const solutions = await fetchSolutions(token)
            this.log(`  Found ${solutions.length} solution(s).`)
            this.log()

            const chosen = await select({
              message: 'Select a solution to filter by:',
              choices: solutions.map((s) => ({name: s.Name, value: s.Name})),
            })

            saveSolutionFilter(chosen)
            this.log()
            this.log(`  Solution filter set to "${chosen}".`)
            this.log()
          } catch {
            this.log('  Failed to fetch solutions. Token may have expired.')
            this.log()
          }

          break
        }

        case 'exit': {
          process.stdout.write('\x1Bc')
          return
        }
      }
    }
  }
}

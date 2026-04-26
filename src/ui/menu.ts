import {select} from '@inquirer/prompts'

export type MenuChoice = 'config' | 'exit' | 'models' | 'models-detail'

export async function mainMenu(): Promise<MenuChoice> {
  return select({
    message: 'What would you like to do?',
    choices: [
      {name: 'List models', value: 'models' as const},
      {name: 'List models (detail)', value: 'models-detail' as const},
      {name: 'Configuration', value: 'config' as const},
      {name: 'Exit', value: 'exit' as const},
    ],
  })
}

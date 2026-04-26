import {select} from '@inquirer/prompts'

export type MenuChoice = 'activity' | 'config' | 'exit' | 'models' | 'models-detail' | 'objects'

export async function mainMenu(): Promise<MenuChoice> {
  return select({
    message: 'What would you like to do?',
    choices: [
      {name: 'List models', value: 'models' as const},
      {name: 'List models (detail)', value: 'models-detail' as const},
      {name: 'List objects in model', value: 'objects' as const},
      {name: 'Activity report (admin)', value: 'activity' as const},
      {name: 'Configuration', value: 'config' as const},
      {name: 'Exit', value: 'exit' as const},
    ],
  })
}

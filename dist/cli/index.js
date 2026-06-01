import { Command } from 'commander';
import { registerAuthCommand } from './commands/auth.js';
import { registerModelsCommand } from './commands/models.js';
import { registerObjectsCommand } from './commands/objects.js';
import { registerDrawingsCommand } from './commands/drawings.js';
import { registerExportCommand } from './commands/export.js';
import { registerActivityCommand } from './commands/activity.js';
import { registerConfigCommand } from './commands/config.js';
import { registerVersionCommand } from './commands/version.js';
import { registerObjectsCreateCommand } from './commands/objects-create.js';
import { registerObjectsUpdateCommand } from './commands/objects-update.js';
import { registerObjectsMoveCommand } from './commands/objects-move.js';
import { registerRelationshipsCreateCommand } from './commands/relationships-create.js';
import { registerRelationshipsUpdateCommand } from './commands/relationships-update.js';
import { registerObjectsDeleteCommand } from './commands/objects-delete.js';
import { registerRelationshipsDeleteCommand } from './commands/relationships-delete.js';
import { registerDocCommand } from './commands/doc.js';
const program = new Command();
program
    .name('orbusctl')
    .description('Orbus Infinity (iServer365) CLI');
registerAuthCommand(program);
registerModelsCommand(program);
registerObjectsCommand(program);
registerDrawingsCommand(program);
registerExportCommand(program);
registerActivityCommand(program);
registerConfigCommand(program);
registerVersionCommand(program);
registerObjectsCreateCommand(program);
registerObjectsUpdateCommand(program);
registerObjectsMoveCommand(program);
registerRelationshipsCreateCommand(program);
registerRelationshipsUpdateCommand(program);
registerObjectsDeleteCommand(program);
registerRelationshipsDeleteCommand(program);
registerDocCommand(program);
export async function run() {
    await program.parseAsync(process.argv);
}

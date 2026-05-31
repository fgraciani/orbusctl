import { fetchModels } from '../core/api/models.js';
import { getShowHiddenModels, getSolutionFilter } from '../core/config.js';
import { resolveMatch } from '../core/domain/resolve.js';

function errExit(msg: string): never {
  process.stderr.write('Error: ' + msg + '\n');
  process.exit(1);
}

export async function resolveModel(
  token: string,
  modelName: string | undefined,
  modelId: string | undefined,
): Promise<{ modelId: string; modelName: string }> {
  const models = await fetchModels(token, getSolutionFilter());

  if (modelId) {
    const found = models.find(m => m.ModelId === modelId);
    if (!found) return errExit(`No model found with ID "${modelId}".`);
    return { modelId: found.ModelId, modelName: found.Name };
  }

  const showHidden = getShowHiddenModels();
  const visible = showHidden ? models : models.filter(m => !m.IsHidden);
  const found = resolveMatch(visible, modelName!, m => m.Name, 'model', errExit);
  return { modelId: found.ModelId, modelName: found.Name };
}

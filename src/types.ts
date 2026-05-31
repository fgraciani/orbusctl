export type Section = 'models' | 'drawings' | 'compare' | 'activity' | 'audit' | 'export' | 'config';
export type FocusedPanel = 'sidebar' | 'main';

export type AuthStatus = 'authenticated' | 'expired' | 'none';

export interface RoleInfo {
  name: string;
  license: string;
}

export interface AuthState {
  status: AuthStatus;
  user?: string;
  roles?: RoleInfo[];
  licenses?: string[];
  isAdmin?: boolean;
}

export interface CRUDCounts { created: number; updated: number; deleted: number }

export interface SessionStats {
  startedAt: Date;
  apiCalls: number;
  tokensUsed: number;
  objects: CRUDCounts;
  relationships: CRUDCounts;
  modelsBrowsed: number;
  exports: { count: number; path: string };
  feedbackEmail: string;
}

// Navigation depth within the models section
export type ModelsView =
  | { level: 'list' }
  | { level: 'objects'; modelId: string; modelName: string };

export const SECTIONS_REQUIRING_AUTH: Section[] = ['models', 'drawings', 'compare', 'activity', 'audit', 'export'];

export const SECTIONS: Section[] = ['models', 'drawings', 'compare', 'activity', 'audit', 'export', 'config'];

export const SECTION_LABELS: Record<Section, string> = {
  models: 'Content',
  drawings: 'Drawings',
  compare: 'Compare',
  activity: 'Activity',
  audit: 'Audit',
  export: 'Export',
  config: 'Config',
};

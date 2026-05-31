import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, useInput, useApp, useStdout } from 'ink';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { MainContent } from './components/MainContent.js';
import { StatsPanel } from './components/StatsPanel.js';
import { HelpPanel } from './components/HelpPanel.js';
import { Footer } from './components/Footer.js';
import { WelcomeModal } from './components/WelcomeModal.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { SECTIONS, SECTIONS_REQUIRING_AUTH, type Section, type FocusedPanel, type AuthState, type ModelsView } from './types.js';
import { getToken, getUser, saveAuth, hasToken, formatTokenAge, getSolutionFilter, saveSolutionFilter, getShowHiddenModels, saveShowHiddenModels, getServer, saveServer, getWritePasswordHash, saveWritePassword, saveBrowser } from './core/config.js';
import { hashPassword } from './core/auth.js';
import { getOrbusObjectUrl, getOrbusDrawingUrl, openInBrowser, openFile } from './core/browser.js';
import { fetchMeWithRoles } from './core/api/me.js';
import { fetchObjects } from './core/api/objects.js';
import { useModels } from './hooks/useModels.js';
import { useObjects } from './hooks/useObjects.js';
import { useObjectDetail } from './hooks/useObjectDetail.js';
import { useDrawings } from './hooks/useDrawings.js';
import { useDrawingDetail } from './hooks/useDrawingDetail.js';
import { useSolutions } from './hooks/useSolutions.js';
import { useExport, type ExportFormat } from './hooks/useExport.js';
import { useTemplateExport } from './hooks/useTemplateExport.js';
import { listTemplates, parseTemplateVariables } from './core/export/template.js';
import { useCompare } from './hooks/useCompare.js';
import { useAudit } from './hooks/useAudit.js';
import { useActivity } from './hooks/useActivity.js';
import { useAuditExport } from './hooks/useAuditExport.js';
import { useActivityExport } from './hooks/useActivityExport.js';
import type { TimePeriod } from './core/domain/activity.js';
import { buildTree, flattenTree } from './core/domain/tree.js';
import { useHeartbeat } from './hooks/useHeartbeat.js';
import { useApiCounter } from './hooks/useApiCounter.js';
import { useApiChart } from './hooks/useApiChart.js';

function loadSavedAuth(): AuthState {
  if (!hasToken()) return { status: 'none' };
  const user = getUser();
  // Optimistic: assume valid, will verify with fetchMe on startup
  return { status: 'authenticated', user: user?.name };
}

export const App: React.FC<{ onStoreExitData: (sessionStart: Date, tokensUsed: number, user?: string) => void }> = (props) => {
  const { stdout } = useStdout();
  const [termSize, setTermSize] = useState({ rows: stdout.rows, cols: stdout.columns });
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>('sidebar');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [mainItemIndex, setMainItemIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [auth, setAuth] = useState<AuthState>(loadSavedAuth);
  const [sessionStart] = useState(() => new Date());
  const [tokensUsed, setTokensUsed] = useState(1);
  const { exit } = useApp();

  const [modelsView, setModelsView] = useState<ModelsView>({ level: 'list' });
  const [viewedObjectId, setViewedObjectId] = useState<string | null>(null);
  const [detailFocused, setDetailFocused] = useState(false);
  const [relIndex, setRelIndex] = useState(0);
  const [drawingsModelId, setDrawingsModelId] = useState<string | null>(null);
  const [drawingsModelName, setDrawingsModelName] = useState<string>('');
  const [viewedDrawingId, setViewedDrawingId] = useState<string | null>(null);
  const [viewedDrawingObjectId, setViewedDrawingObjectId] = useState<string | null>(null);
  const [drawingDetailFocused, setDrawingDetailFocused] = useState(false);
  const [drawingRelIndex, setDrawingRelIndex] = useState(0);
  const [viewedAuditObjectId, setViewedAuditObjectId] = useState<string | null>(null);
  const [auditDetailFocused, setAuditDetailFocused] = useState(false);
  const [auditRelIndex, setAuditRelIndex] = useState(0);

  const realToken = auth.status === 'authenticated' ? getToken() ?? null : null;
  const { models, counts: modelCounts, loading: modelsLoading, error: modelsError } = useModels(realToken);

  const objectsModelId = modelsView.level === 'objects' ? modelsView.modelId : null;
  const { objects, loading: objectsLoading, error: objectsError } = useObjects(realToken, objectsModelId);

  // Detail loads only when user explicitly presses Enter on an object
  const { detail: objectDetail, relationships: objectRelationships, loading: detailLoading, error: detailError } = useObjectDetail(realToken, viewedObjectId);

  const { drawings, typeMap: drawingTypeMap, loading: drawingsLoading, error: drawingsError } = useDrawings(realToken, drawingsModelId);
  const { components: drawingComponents, loading: drawingDetailLoading, error: drawingDetailError } = useDrawingDetail(realToken, viewedDrawingId);
  const { detail: drawingObjectDetail, relationships: drawingObjectRelationships, loading: drawingObjectDetailLoading, error: drawingObjectDetailError } = useObjectDetail(realToken, viewedDrawingObjectId);
  const { detail: auditObjectDetail, relationships: auditObjectRelationships, loading: auditDetailLoading, error: auditDetailError } = useObjectDetail(realToken, viewedAuditObjectId);
  const { solutions } = useSolutions(realToken);
  const exportHook = useExport();
  const templateExport = useTemplateExport();
  const [exportTemplatePicking, setExportTemplatePicking] = useState(false);
  const [exportTemplate, setExportTemplate] = useState<{ name: string; path: string } | null>(null);
  const [exportTemplates, setExportTemplates] = useState<Array<{ name: string; path: string }>>([]);
  const [exportTemplateVars, setExportTemplateVars] = useState<Array<{ name: string; prompt: string; objectType?: string }>>([]);
  const [exportVarValues, setExportVarValues] = useState<Record<string, string>>({});
  const [exportVarIndex, setExportVarIndex] = useState(-1);
  const [exportVarInput, setExportVarInput] = useState('');
  const [exportVarOptions, setExportVarOptions] = useState<string[]>([]);
  const [exportVarLoading, setExportVarLoading] = useState(false);
  const [compareModelAId, setCompareModelAId] = useState<string | null>(null);
  const [compareModelAName, setCompareModelAName] = useState('');
  const [compareModelBId, setCompareModelBId] = useState<string | null>(null);
  const [compareModelBName, setCompareModelBName] = useState('');
  const compare = useCompare(realToken, compareModelAId, compareModelBId);
  const audit = useAudit();
  const auditExport = useAuditExport();
  const activityExport = useActivityExport();
  const [auditIssueFilter, setAuditIssueFilter] = useState<string | null>(null);
  const [auditMode, setAuditMode] = useState<'menu' | 'select-model' | 'select-models' | 'all-results' | 'detail'>('menu');
  const [auditSelectedModelIds, setAuditSelectedModelIds] = useState<Set<string>>(new Set());
  const [exportModelId, setExportModelId] = useState<string | null>(null);
  const [exportModelName, setExportModelName] = useState('');
  const EXPORT_FORMATS: { label: string; value: ExportFormat | 'template' }[] = [
    { label: 'Excel (.xlsx)', value: 'excel' },
    { label: 'Markdown (.md)', value: 'markdown' },
    { label: 'Markdown Template (.md)', value: 'template' },
  ];
  const [configEditing, setConfigEditing] = useState<string | null>(null); // which setting is being edited
  const [configTextInput, setConfigTextInput] = useState('');
  const activity = useActivity();
  const [activityModelIndex, setActivityModelIndex] = useState<number | null>(null);
  const TIME_PERIODS: TimePeriod[] = ['24h', '7d', 'past-week', '30d', 'past-month'];

  const modelFlat = useMemo(
    () => models.length > 0 ? flattenTree(buildTree(models)) : [],
    [models],
  );

  useEffect(() => {
    const onResize = () => setTermSize({ rows: stdout.rows, cols: stdout.columns });
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
  }, [stdout]);

  // Fetch roles on startup if we have a valid token from config
  useEffect(() => {
    if (auth.status === 'authenticated' && !auth.roles && realToken) {
      fetchMeWithRoles(realToken).then(me => {
        const meRoles = me.Roles ?? [];
        const roles = meRoles.map(r => ({ name: r.Name, license: r.LicenseTypeCategoryId })).sort((a, b) => a.name.localeCompare(b.name));
        const licenses = [...new Set(meRoles.map(r => r.LicenseTypeCategoryId).filter(Boolean))].sort();
        const isAdmin = me.FeaturePermissions?.HasModelAdministrationPermission ?? false;
        setAuth(prev => ({ ...prev, roles, licenses, isAdmin }));
      }).catch(() => {
        setAuth(prev => ({ ...prev, status: 'expired' }));
        setShowModal(true);
      });
    }
  }, [auth.status, realToken]);

  const activeSection: Section = SECTIONS[sectionIndex];
  const isLocked = SECTIONS_REQUIRING_AUTH.includes(activeSection) && auth.status !== 'authenticated';
  const modalActive = showModal || showExitConfirm;

  const { status: heartbeatStatus, latencyMs: heartbeatLatency, lastCheck: heartbeatLastCheck } = useHeartbeat(realToken, modalActive);
  const { total: apiTotal, startup: apiStartup, heartbeat: apiHeartbeat, userByMethod: apiUserByMethod } = useApiCounter();
  const { buckets: chartBuckets, activeMethods: chartActiveMethods } = useApiChart(22);

  useEffect(() => {
    if (heartbeatStatus === 'unauthorized' && !modalActive) {
      setAuth(prev => ({ ...prev, status: 'expired' }));
      setShowModal(true);
    }
  }, [heartbeatStatus, modalActive]);

  useEffect(() => {
    setViewedDrawingObjectId(null);
    setDrawingDetailFocused(false);
    setDrawingRelIndex(0);
  }, [viewedDrawingId]);

  const maxMainItems = (() => {
    if (isLocked) return 0;
    switch (activeSection) {
      case 'models':
        return modelsView.level === 'list' ? modelFlat.length : objects.length;
      case 'drawings':
        return viewedDrawingId ? drawingComponents.length : drawingsModelId ? drawings.length : modelFlat.length;
      case 'audit':
        if (auditMode === 'menu') return 3;
        if (auditMode === 'select-model') return modelFlat.length;
        if (auditMode === 'select-models') return modelFlat.length;
        if (auditMode === 'detail' && audit.result && auditIssueFilter) return audit.result.issues.filter(i => i.issueType === auditIssueFilter).length;
        if (auditMode === 'detail' && audit.result) return Object.keys(audit.result.issuesByType).length;
        if (auditMode === 'all-results') return modelFlat.length;
        if (audit.auditing || audit.scanningAll) return 0;
        return 0;
      case 'compare':
        if (compareModelBId) return compare.rows.length;
        return modelFlat.length; // selecting model A or B
      case 'export':
        if (templateExport.exporting || templateExport.result || templateExport.error) return 0;
        if (exportHook.result || exportHook.exporting) return 0;
        if (exportVarIndex >= 0) return exportVarOptions.length > 0 ? exportVarOptions.length : 0;
        if (exportTemplatePicking) return exportTemplates.length;
        if (exportModelId) return EXPORT_FORMATS.length;
        return modelFlat.length;
      case 'config':
        if (configEditing === 'solution') return solutions.length + 1;
        if (configEditing === 'browser') return 5;
        if (configEditing) return 0;
        return 6; // server, solution, hidden, token, write-password, browser
      case 'activity':
        if (activity.report && activityModelIndex !== null) {
          const m = activity.report.models[activityModelIndex];
          return m ? m.totalObjects + m.totalRels : 0;
        }
        if (activity.report) return activity.report.models.length;
        if (activity.scanning) return 0;
        return TIME_PERIODS.length;
      default: return 0;
    }
  })();

  useInput((input, key) => {
    if (modalActive) return;

    // Suppress single-key global shortcuts while the user is typing in a text field
    const isTypingMode = configEditing === 'server' || configEditing === 'write-password' || (activeSection === 'export' && exportVarIndex >= 0 && exportVarOptions.length === 0);

    if (input === 'c' && key.ctrl) { audit.reset(); exit(); return; }
    if (!isTypingMode) {
      if (input === 'q') { audit.reset(); setAuditMode('menu'); setAuditSelectedModelIds(new Set()); setViewedAuditObjectId(null); setAuditDetailFocused(false); setAuditRelIndex(0); setShowExitConfirm(true); return; }
      if (input === 'a') { setShowModal(true); return; }
      if (input === 's') { setShowStats(prev => !prev); return; }
      if (input === '?') { setShowHelp(prev => !prev); return; }
    }

    if (key.tab) {
      if (!isLocked) setFocusedPanel(prev => prev === 'sidebar' ? 'main' : 'sidebar');
      return;
    }

    if (focusedPanel === 'sidebar') {
      if (key.downArrow || input === 'j') {
        setSectionIndex(prev => (prev + 1) % SECTIONS.length);
        setMainItemIndex(0);
        setModelsView({ level: 'list' });
        setViewedObjectId(null);
        setDrawingsModelId(null);
        setViewedDrawingId(null);
        activity.reset();
        activityExport.reset();
        setActivityModelIndex(null);
        setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        auditExport.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
      } else if (key.upArrow || input === 'k') {
        setSectionIndex(prev => (prev - 1 + SECTIONS.length) % SECTIONS.length);
        setMainItemIndex(0);
        setModelsView({ level: 'list' });
        setViewedObjectId(null);
        setDrawingsModelId(null);
        setViewedDrawingId(null);
        activity.reset();
        activityExport.reset();
        setActivityModelIndex(null);
        setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        auditExport.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
      } else if (key.return || key.rightArrow || input === 'l') {
        if (maxMainItems > 0) setFocusedPanel('main');
      }
      return;
    }

    // Detail panel focused — navigate relationships
    if (detailFocused && activeSection === 'models') {
      if (key.downArrow || input === 'j') {
        setRelIndex(prev => objectRelationships.length > 0 ? (prev + 1) % objectRelationships.length : 0);
      } else if (key.upArrow || input === 'k') {
        setRelIndex(prev => objectRelationships.length > 0 ? (prev - 1 + objectRelationships.length) % objectRelationships.length : 0);
      } else if (key.return || key.rightArrow || input === 'l') {
        if (objectRelationships[relIndex]) {
          setViewedObjectId(objectRelationships[relIndex].RelatedItem.ObjectId);
          setRelIndex(0);
        }
      } else if (key.escape || key.leftArrow || input === 'h') {
        setDetailFocused(false);
      }
      return;
    }

    if (drawingDetailFocused && activeSection === 'drawings') {
      if (key.downArrow || input === 'j') {
        setDrawingRelIndex(prev => drawingObjectRelationships.length > 0 ? (prev + 1) % drawingObjectRelationships.length : 0);
      } else if (key.upArrow || input === 'k') {
        setDrawingRelIndex(prev => drawingObjectRelationships.length > 0 ? (prev - 1 + drawingObjectRelationships.length) % drawingObjectRelationships.length : 0);
      } else if (key.return || key.rightArrow || input === 'l') {
        if (drawingObjectRelationships[drawingRelIndex]) {
          setViewedDrawingObjectId(drawingObjectRelationships[drawingRelIndex].RelatedItem.ObjectId);
          setDrawingRelIndex(0);
        }
      } else if (key.escape || key.leftArrow || input === 'h') {
        setDrawingDetailFocused(false);
      }
      return;
    }

    if (auditDetailFocused && activeSection === 'audit') {
      if (key.downArrow || input === 'j') {
        setAuditRelIndex(prev => auditObjectRelationships.length > 0 ? (prev + 1) % auditObjectRelationships.length : 0);
      } else if (key.upArrow || input === 'k') {
        setAuditRelIndex(prev => auditObjectRelationships.length > 0 ? (prev - 1 + auditObjectRelationships.length) % auditObjectRelationships.length : 0);
      } else if (key.return || key.rightArrow || input === 'l') {
        if (auditObjectRelationships[auditRelIndex]) {
          setViewedAuditObjectId(auditObjectRelationships[auditRelIndex].RelatedItem.ObjectId);
          setAuditRelIndex(0);
        }
      } else if (key.escape || key.leftArrow || input === 'h') {
        setAuditDetailFocused(false);
      }
      return;
    }

    // Export variable input / pick
    if (activeSection === 'export' && exportVarIndex >= 0) {
      const currentVar = exportTemplateVars[exportVarIndex];

      const advanceVar = (value: string) => {
        const updated = { ...exportVarValues, [currentVar.name]: value };
        if (exportVarIndex + 1 < exportTemplateVars.length) {
          const nextVar = exportTemplateVars[exportVarIndex + 1];
          setExportVarValues(updated);
          setExportVarIndex(exportVarIndex + 1);
          setExportVarInput('');
          setExportVarOptions([]);
          setMainItemIndex(0);
          if (nextVar.objectType && realToken && exportModelId) {
            setExportVarLoading(true);
            fetchObjects(realToken, exportModelId)
              .then(objs => {
                const names = objs
                  .filter(o => o.ObjectType.Name.toLowerCase() === nextVar.objectType!.toLowerCase())
                  .map(o => o.Name).sort();
                setExportVarOptions(names);
              })
              .catch(() => setExportVarOptions([]))
              .finally(() => setExportVarLoading(false));
          }
        } else {
          if (realToken && exportModelId && exportTemplate) {
            templateExport.startExport(realToken, exportModelId, exportModelName, exportTemplate.path, updated);
          }
          setExportVarIndex(-1);
          setExportVarValues({});
          setExportVarOptions([]);
          setMainItemIndex(0);
        }
      };

      const cancelVar = () => {
        setExportVarIndex(-1);
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportTemplatePicking(true);
        setExportVarInput('');
        setExportVarValues({});
        setMainItemIndex(0);
      };

      if (exportVarOptions.length > 0) {
        // Pick mode
        if (key.downArrow || input === 'j') {
          setMainItemIndex(prev => (prev + 1) % exportVarOptions.length);
        } else if (key.upArrow || input === 'k') {
          setMainItemIndex(prev => (prev - 1 + exportVarOptions.length) % exportVarOptions.length);
        } else if (key.return || key.rightArrow || input === 'l') {
          const selected = exportVarOptions[mainItemIndex];
          if (selected) advanceVar(selected);
        } else if (key.escape || key.leftArrow || input === 'h') {
          cancelVar();
        }
      } else {
        // Text input mode
        if (key.return) {
          advanceVar(exportVarInput);
        } else if (key.escape) {
          cancelVar();
        } else if (key.backspace || key.delete) {
          setExportVarInput(prev => prev.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setExportVarInput(prev => prev + input);
        }
      }
      return;
    }

    // Config text editing mode
    if (configEditing === 'write-password-log') {
      if (key.return) {
        setConfigEditing('write-password');
        setConfigTextInput('');
      } else if (key.escape) {
        setConfigEditing(null);
        setMainItemIndex(4);
      }
      return;
    }

    if (configEditing === 'write-password') {
      if (key.return) {
        if (configTextInput) {
          const { hash, salt } = hashPassword(configTextInput);
          saveWritePassword(hash, salt);
        }
        setConfigEditing(null);
        setConfigTextInput('');
        setMainItemIndex(4);
      } else if (key.escape) {
        setConfigEditing(null);
        setConfigTextInput('');
        setMainItemIndex(4);
      } else if (key.backspace || key.delete) {
        setConfigTextInput(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setConfigTextInput(prev => prev + input);
      }
      return;
    }

    if (configEditing === 'server') {
      if (key.return) {
        saveServer(configTextInput);
        setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
        setMainItemIndex(0);
      } else if (key.escape) {
        setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
        setMainItemIndex(0);
      } else if (key.backspace || key.delete) {
        setConfigTextInput(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setConfigTextInput(prev => prev + input);
      }
      return;
    }

    // Browser launch key
    if (input === 'o' && focusedPanel === 'main') {
      if (activeSection === 'export' && templateExport.result) {
        openFile(templateExport.result.filePath);
      } else if (activeSection === 'export' && exportHook.result) {
        openFile(exportHook.result.filePath);
      } else if (activeSection === 'audit' && auditExport.result) {
        openFile(auditExport.result.filePath);
      } else if (activeSection === 'activity' && activityExport.result) {
        openFile(activityExport.result.filePath);
      } else if (activeSection === 'models' && viewedObjectId) {
        openInBrowser(getOrbusObjectUrl(viewedObjectId));
      } else if (activeSection === 'drawings' && viewedDrawingObjectId) {
        openInBrowser(getOrbusObjectUrl(viewedDrawingObjectId));
      } else if (activeSection === 'drawings' && viewedDrawingId) {
        openInBrowser(getOrbusDrawingUrl(viewedDrawingId));
      } else if (activeSection === 'audit' && viewedAuditObjectId) {
        openInBrowser(getOrbusObjectUrl(viewedAuditObjectId));
      }
      return;
    }

    // Export key
    if (input === 'e' && focusedPanel === 'main') {
      if (activeSection === 'audit' && !auditExport.exporting && !auditExport.result && !auditExport.error) {
        if (auditMode === 'all-results' && audit.modelResults.size > 0 && !audit.scanningAll) {
          auditExport.startExport([...audit.modelResults.values()]);
        } else if (auditMode === 'detail' && audit.result) {
          auditExport.startExport([audit.result]);
        }
      } else if (activeSection === 'activity' && activity.report && !activityExport.exporting && !activityExport.result && !activityExport.error) {
        activityExport.startExport(activity.report);
      }
      return;
    }

    // Space bar toggle for multi-select
    if (input === ' ' && activeSection === 'audit' && auditMode === 'select-models' && modelFlat[mainItemIndex]) {
      const modelId = modelFlat[mainItemIndex].model.ModelId;
      setAuditSelectedModelIds(prev => {
        const next = new Set(prev);
        next.has(modelId) ? next.delete(modelId) : next.add(modelId);
        return next;
      });
      return;
    }

    // Main panel navigation
    if (key.downArrow || input === 'j') {
      setMainItemIndex(prev => maxMainItems > 0 ? (prev + 1) % maxMainItems : 0);
    } else if (key.upArrow || input === 'k') {
      setMainItemIndex(prev => maxMainItems > 0 ? (prev - 1 + maxMainItems) % maxMainItems : 0);
    } else if (key.return || key.rightArrow || input === 'l') {
      if (activeSection === 'models') {
        if (modelsView.level === 'list' && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          setModelsView({ level: 'objects', modelId: m.ModelId, modelName: m.Name });
          setMainItemIndex(0);
          setViewedObjectId(null);
          setDetailFocused(false);
        } else if (modelsView.level === 'objects' && objects[mainItemIndex]) {
          const objId = objects[mainItemIndex].ObjectId;
          if (viewedObjectId === objId) {
            setDetailFocused(true);
            setRelIndex(0);
          } else {
            setViewedObjectId(objId);
            setDetailFocused(false);
          }
        }
      } else if (activeSection === 'audit') {
        if (auditMode === 'menu') {
          if (mainItemIndex === 0) { setAuditMode('select-model'); setMainItemIndex(0); }
          else if (mainItemIndex === 1 && realToken) { audit.startScanAll(realToken, modelFlat.map(e => e.model)); setAuditMode('all-results'); setMainItemIndex(0); }
          else if (mainItemIndex === 2) { setAuditMode('select-models'); setAuditSelectedModelIds(new Set()); setMainItemIndex(0); }
        } else if (auditMode === 'select-models' && realToken && auditSelectedModelIds.size > 0) {
          const selectedModels = modelFlat.filter(e => auditSelectedModelIds.has(e.model.ModelId)).map(e => e.model);
          audit.startScanAll(realToken, selectedModels);
          setAuditMode('all-results');
          setMainItemIndex(0);
        } else if (auditMode === 'select-model' && realToken && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          audit.startAudit(realToken, m.ModelId, m.Name);
          setAuditMode('detail');
          setMainItemIndex(0);
        } else if (auditMode === 'all-results' && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          audit.selectModel(m.ModelId);
          setAuditMode('detail');
          setMainItemIndex(0);
        } else if (auditMode === 'detail' && audit.result && !auditIssueFilter) {
          const types = Object.keys(audit.result.issuesByType);
          if (types[mainItemIndex]) { setAuditIssueFilter(types[mainItemIndex]); setMainItemIndex(0); }
        } else if (auditMode === 'detail' && audit.result && auditIssueFilter) {
          const filtered = audit.result.issues.filter(i => i.issueType === auditIssueFilter);
          const issue = filtered[mainItemIndex];
          if (issue) {
            if (viewedAuditObjectId === issue.objectId) {
              setAuditDetailFocused(true);
              setAuditRelIndex(0);
            } else {
              setViewedAuditObjectId(issue.objectId);
              setAuditDetailFocused(false);
            }
          }
        }
      } else if (activeSection === 'compare') {
        if (!compareModelAId && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          setCompareModelAId(m.ModelId);
          setCompareModelAName(m.Name);
          setMainItemIndex(0);
        } else if (compareModelAId && !compareModelBId && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          setCompareModelBId(m.ModelId);
          setCompareModelBName(m.Name);
          setMainItemIndex(0);
        }
      } else if (activeSection === 'export') {
        if (!exportModelId && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          setExportModelId(m.ModelId);
          setExportModelName(m.Name);
          setMainItemIndex(0);
        } else if (exportTemplatePicking && exportTemplates[mainItemIndex]) {
          const tmpl = exportTemplates[mainItemIndex];
          const vars = parseTemplateVariables(tmpl.path);
          setExportTemplate(tmpl);
          setExportTemplateVars(vars);
          setExportTemplatePicking(false);
          if (vars.length > 0) {
            setExportVarIndex(0);
            setExportVarValues({});
            setExportVarInput('');
            setExportVarOptions([]);
            setMainItemIndex(0);
            const firstVar = vars[0];
            if (firstVar.objectType && realToken && exportModelId) {
              setExportVarLoading(true);
              fetchObjects(realToken, exportModelId)
                .then(objs => {
                  const names = objs
                    .filter(o => o.ObjectType.Name.toLowerCase() === firstVar.objectType!.toLowerCase())
                    .map(o => o.Name).sort();
                  setExportVarOptions(names);
                })
                .catch(() => setExportVarOptions([]))
                .finally(() => setExportVarLoading(false));
            }
          } else if (realToken && exportModelId) {
            templateExport.startExport(realToken, exportModelId, exportModelName, tmpl.path, {});
          }
          setMainItemIndex(0);
        } else if (exportModelId && !exportTemplatePicking && exportVarIndex < 0 && !exportHook.exporting && !exportHook.result && !templateExport.exporting && !templateExport.result && realToken) {
          const fmt = EXPORT_FORMATS[mainItemIndex];
          if (fmt?.value === 'template') {
            setExportTemplates(listTemplates());
            setExportTemplatePicking(true);
            setMainItemIndex(0);
          } else if (fmt) {
            exportHook.startExport(realToken, exportModelId, exportModelName, fmt.value as ExportFormat, true);
          }
        }
      } else if (activeSection === 'config') {
        if (configEditing === 'browser') {
          const BROWSER_VALUES = [undefined, 'Microsoft Edge', 'Google Chrome', 'Firefox', 'Safari'];
          saveBrowser(BROWSER_VALUES[mainItemIndex]);
          setConfigEditing(null);
          setMainItemIndex(5);
        } else if (configEditing === 'solution') {
          // Select solution or "All models"
          if (mainItemIndex === 0) {
            saveSolutionFilter(undefined);
          } else {
            saveSolutionFilter(solutions[mainItemIndex - 1]?.Name);
          }
          setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
          setMainItemIndex(1); // back to solution row
        } else if (!configEditing) {
          switch (mainItemIndex) {
            case 0: // Server
              setConfigEditing('server');
              setConfigTextInput(getServer());
              break;
            case 1: // Solution filter
              setConfigEditing('solution');
              setMainItemIndex(0);
              break;
            case 2: // Show hidden
              saveShowHiddenModels(!getShowHiddenModels());
              break;
            case 3: // Token — open auth modal
              setShowModal(true);
              break;
            case 4: // Write password
              if (getWritePasswordHash()) {
                setConfigEditing('write-password-log');
              } else {
                setConfigEditing('write-password');
                setConfigTextInput('');
              }
              break;
            case 5: // Browser
              setConfigEditing('browser');
              setMainItemIndex(0);
              break;
          }
        }
      } else if (activeSection === 'activity') {
        if (activity.report && activityModelIndex === null) {
          setActivityModelIndex(mainItemIndex);
          setMainItemIndex(0);
        } else if (!activity.report && !activity.scanning && realToken) {
          activity.startScan(realToken, models, TIME_PERIODS[mainItemIndex]);
        }
      } else if (activeSection === 'drawings') {
        if (!drawingsModelId && modelFlat[mainItemIndex]) {
          const m = modelFlat[mainItemIndex].model;
          setDrawingsModelId(m.ModelId);
          setDrawingsModelName(m.Name);
          setMainItemIndex(0);
        } else if (drawingsModelId && !viewedDrawingId && drawings[mainItemIndex]) {
          setViewedDrawingId(drawings[mainItemIndex].DocumentId);
          setMainItemIndex(0);
        } else if (viewedDrawingId) {
          const comp = drawingComponents[mainItemIndex];
          if (comp && !comp.isRelationship && comp.objectId) {
            if (viewedDrawingObjectId === comp.objectId) {
              setDrawingDetailFocused(true);
              setDrawingRelIndex(0);
            } else {
              setViewedDrawingObjectId(comp.objectId);
              setDrawingDetailFocused(false);
            }
          }
        }
      }
    } else if (key.escape || key.leftArrow || input === 'h') {
      if (activeSection === 'models') {
        if (modelsView.level === 'objects') {
          setModelsView({ level: 'list' });
          setMainItemIndex(0);
          setViewedObjectId(null);
          setDetailFocused(false);
        } else {
          setFocusedPanel('sidebar');
        }
      } else if (activeSection === 'audit') {
        if (auditExport.result || auditExport.error) {
          auditExport.reset();
        } else if (auditIssueFilter && viewedAuditObjectId) {
          setViewedAuditObjectId(null);
          setAuditDetailFocused(false);
        } else if (auditIssueFilter) {
          setAuditIssueFilter(null);
          setMainItemIndex(0);
        } else if (auditMode === 'detail') {
          setAuditMode(audit.modelResults.size > 0 ? 'all-results' : 'menu');
          setMainItemIndex(0);
          if (audit.modelResults.size === 0) audit.reset();
        } else if (auditMode === 'all-results' || auditMode === 'select-model' || auditMode === 'select-models') {
          audit.reset();
          setAuditMode('menu');
          setAuditSelectedModelIds(new Set());
          setMainItemIndex(0);
        } else {
          setFocusedPanel('sidebar');
        }
      } else if (activeSection === 'compare') {
        if (compareModelBId) {
          setCompareModelBId(null);
          setMainItemIndex(0);
        } else if (compareModelAId) {
          setCompareModelAId(null);
          setMainItemIndex(0);
        } else {
          setFocusedPanel('sidebar');
        }
      } else if (activeSection === 'export') {
        if (templateExport.result || templateExport.error) {
          templateExport.reset();
          setExportTemplate(null);
          setExportTemplatePicking(false);
          setExportTemplateVars([]);
          setExportVarOptions([]);
          setExportVarLoading(false);
          setExportModelId(null);
          setMainItemIndex(0);
        } else if (exportHook.result || exportHook.error) {
          exportHook.reset();
          setExportModelId(null);
          setMainItemIndex(0);
        } else if (exportTemplatePicking) {
          setExportTemplatePicking(false);
          setExportTemplate(null);
          setMainItemIndex(2); // back to format selector at Template row
        } else if (exportModelId) {
          setExportModelId(null);
          setMainItemIndex(0);
        } else {
          setFocusedPanel('sidebar');
        }
      } else if (activeSection === 'config') {
        if (configEditing) {
          setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
          setMainItemIndex(0);
        } else {
          setFocusedPanel('sidebar');
        }
      } else if (activeSection === 'activity') {
        if (activityExport.result || activityExport.error) {
          activityExport.reset();
        } else if (activityModelIndex !== null) {
          setActivityModelIndex(null);
          setMainItemIndex(0);
        } else if (activity.report || activity.scanning) {
          activity.reset();
        setActivityModelIndex(null);
        setConfigEditing(null);
        exportHook.reset();
        templateExport.reset();
        setExportTemplatePicking(false);
        setExportTemplate(null);
        setExportTemplateVars([]);
        setExportVarValues({});
        setExportVarIndex(-1);
        setExportVarInput('');
        setExportVarOptions([]);
        setExportVarLoading(false);
        setExportModelId(null);
        setCompareModelAId(null);
        setCompareModelBId(null);
        audit.reset();
        setAuditIssueFilter(null);
        setAuditMode('menu');
        setAuditSelectedModelIds(new Set());
        setViewedAuditObjectId(null);
        setAuditDetailFocused(false);
        setAuditRelIndex(0);
          setMainItemIndex(0);
        } else {
          setFocusedPanel('sidebar');
        }
      } else if (activeSection === 'drawings') {
        if (viewedDrawingObjectId) {
          setViewedDrawingObjectId(null);
          setDrawingDetailFocused(false);
        } else if (viewedDrawingId) {
          setViewedDrawingId(null);
          setMainItemIndex(0);
        } else if (drawingsModelId) {
          setDrawingsModelId(null);
          setMainItemIndex(0);
        } else {
          setFocusedPanel('sidebar');
        }
      } else {
        setFocusedPanel('sidebar');
      }
    }
  });

  const handleAuthenticated = async (token: string) => {
    const me = await fetchMeWithRoles(token);
    saveAuth(token, { name: me.Name, accountName: me.AccountName, emailAddress: me.EmailAddress });
    const meRoles = me.Roles ?? [];
    const roles = meRoles.map(r => ({ name: r.Name, license: r.LicenseTypeCategoryId })).sort((a, b) => a.name.localeCompare(b.name));
    const licenses = [...new Set(meRoles.map(r => r.LicenseTypeCategoryId).filter(Boolean))].sort();
    const isAdmin = me.FeaturePermissions?.HasModelAdministrationPermission ?? false;
    setAuth({ status: 'authenticated', user: me.Name, roles, licenses, isAdmin });
    setTokensUsed(n => n + 1);
    setShowModal(false);
  };

  const handleSkip = () => {
    setAuth(prev => ({ ...prev, status: 'none' }));
    setShowModal(false);
  };

  return (
    <Box flexDirection="column" width="100%" height={termSize.rows}>

      {showExitConfirm && (
        <ConfirmModal
          sessionStart={sessionStart}
          tokensUsed={tokensUsed}
          user={auth.user}
          onConfirm={() => { props.onStoreExitData(sessionStart, tokensUsed, auth.user); exit(); }}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
      {!showExitConfirm && showModal && (
        <WelcomeModal
          auth={auth}
          onAuthenticated={handleAuthenticated}
          onSkip={handleSkip}
          onDismiss={() => setShowModal(false)}
        />
      )}

      <Box display={modalActive ? 'none' : 'flex'} flexDirection="column" width="100%" flexGrow={1}>
        <Header auth={auth} heartbeatStatus={heartbeatStatus} heartbeatLastCheck={heartbeatLastCheck} />
        <Box flexGrow={1} alignItems="stretch">
          <Sidebar sectionIndex={sectionIndex} focused={focusedPanel === 'sidebar'} auth={auth} />
          <MainContent
            section={activeSection}
            selectedIndex={mainItemIndex}
            focused={focusedPanel === 'main'}
            auth={auth}
            models={models}
            modelFlat={modelFlat}
            modelCounts={modelCounts}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            modelsView={modelsView}
            objects={objects}
            objectsLoading={objectsLoading}
            objectsError={objectsError}
            objectDetail={objectDetail}
            objectRelationships={objectRelationships}
            detailLoading={detailLoading}
            detailError={detailError}
            viewedObjectId={viewedObjectId}
            detailFocused={detailFocused}
            relIndex={relIndex}
            drawings={drawings}
            drawingTypeMap={drawingTypeMap}
            drawingsLoading={drawingsLoading}
            drawingsError={drawingsError}
            drawingsModelId={drawingsModelId}
            drawingsModelName={drawingsModelName}
            viewedDrawingId={viewedDrawingId}
            drawingComponents={drawingComponents}
            drawingDetailLoading={drawingDetailLoading}
            drawingDetailError={drawingDetailError}
            viewedDrawingObjectId={viewedDrawingObjectId}
            drawingObjectDetail={drawingObjectDetail}
            drawingObjectRelationships={drawingObjectRelationships}
            drawingObjectDetailLoading={drawingObjectDetailLoading}
            drawingObjectDetailError={drawingObjectDetailError}
            drawingDetailFocused={drawingDetailFocused}
            drawingRelIndex={drawingRelIndex}
            termRows={termSize.rows - (showHelp ? 4 : 0)}
            termCols={termSize.cols}
            showStats={showStats}
            activity={activity}
            activityPeriods={TIME_PERIODS}
            activityModelIndex={activityModelIndex}
            audit={audit}
            auditIssueFilter={auditIssueFilter}
            auditMode={auditMode}
            auditSelectedModelIds={auditSelectedModelIds}
            viewedAuditObjectId={viewedAuditObjectId}
            auditObjectDetail={auditObjectDetail}
            auditObjectRelationships={auditObjectRelationships}
            auditDetailLoading={auditDetailLoading}
            auditDetailError={auditDetailError}
            auditDetailFocused={auditDetailFocused}
            auditRelIndex={auditRelIndex}
            compare={compare}
            compareModelAId={compareModelAId}
            compareModelAName={compareModelAName}
            compareModelBId={compareModelBId}
            compareModelBName={compareModelBName}
            auditExport={auditExport}
            activityExport={activityExport}
            exportHook={exportHook}
            templateExport={templateExport}
            exportTemplatePicking={exportTemplatePicking}
            exportTemplates={exportTemplates}
            exportTemplate={exportTemplate}
            exportTemplateVars={exportTemplateVars}
            exportVarIndex={exportVarIndex}
            exportVarInput={exportVarInput}
            exportVarOptions={exportVarOptions}
            exportVarLoading={exportVarLoading}
            exportModelId={exportModelId}
            exportFormats={EXPORT_FORMATS}
            configEditing={configEditing}
            configTextInput={configTextInput}
            solutions={solutions}
          />
          <Box display={showStats ? 'flex' : 'none'}>
            <StatsPanel auth={auth} sessionStart={sessionStart} heartbeatLatency={heartbeatLatency} apiTotal={apiTotal} apiStartup={apiStartup} apiHeartbeat={apiHeartbeat} apiUserByMethod={apiUserByMethod} chartBuckets={chartBuckets} chartActiveMethods={chartActiveMethods} />
          </Box>
        </Box>
        <Box display={showHelp ? 'flex' : 'none'}>
          <HelpPanel
            section={activeSection}
            modelsView={modelsView}
            viewedObjectId={viewedObjectId}
            viewedDrawingId={viewedDrawingId}
            viewedDrawingObjectId={viewedDrawingObjectId}
            auditMode={auditMode}
            configEditing={configEditing}
            activityHasReport={activity.report !== null}
            activityScanning={activity.scanning}
            activityModelIndex={activityModelIndex}
            exportModelId={exportModelId}
            exportDone={exportHook.result !== null}
            exportInProgress={exportHook.exporting}
          />
        </Box>
        <Footer focusedPanel={focusedPanel} section={activeSection} showStats={showStats} />
      </Box>

    </Box>
  );
};


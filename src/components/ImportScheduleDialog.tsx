import { useMemo, useState, type ChangeEvent } from 'react';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import type { Child, Event, EventCategory } from '../models';
import type { ScheduleImportResult } from '../services/sharedFamilyData';
import {
  buildScheduleImportRows,
  maxScheduleImportCsvBytes,
  type ColumnMapping,
  type ScheduleImportField,
  type ScheduleImportInputRow,
  type ScheduleImportMode,
} from '../services/scheduleImport';

interface ImportScheduleDialogProps {
  isOpen: boolean;
  children: Child[];
  availableCategories: EventCategory[];
  existingEvents: Event[];
  onClose: () => void;
  onImport: (payload: {
    targetMemberId: string;
    defaultCategory: EventCategory;
    mode: ScheduleImportMode;
    startDate?: string;
    endDate?: string | null;
    batchId: string;
    rows: ScheduleImportInputRow[];
  }) => Promise<ScheduleImportResult>;
}

const importFields: Array<{ key: ScheduleImportField; translationKey: 'date' | 'daysFilter' | 'startTime' | 'endTime' | 'title' | 'location' | 'notes' | 'activityTypeFilter' }> = [
  { key: 'date', translationKey: 'date' },
  { key: 'day', translationKey: 'daysFilter' },
  { key: 'startTime', translationKey: 'startTime' },
  { key: 'endTime', translationKey: 'endTime' },
  { key: 'title', translationKey: 'title' },
  { key: 'location', translationKey: 'location' },
  { key: 'notes', translationKey: 'notes' },
  { key: 'category', translationKey: 'activityTypeFilter' },
];

export function ImportScheduleDialog({
  isOpen,
  children,
  availableCategories,
  existingEvents,
  onClose,
  onImport,
}: ImportScheduleDialogProps) {
  const { language, t } = useUiPreferences();
  const [csvText, setCsvText] = useState('');
  const [targetMemberId, setTargetMemberId] = useState(children[0]?.id ?? '');
  const [defaultCategory, setDefaultCategory] = useState<EventCategory>(availableCategories[0] ?? 'basketball');
  const [mode, setMode] = useState<ScheduleImportMode>('dated');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [deselectedRows, setDeselectedRows] = useState<Set<number>>(() => new Set());
  const [result, setResult] = useState<ScheduleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const preview = useMemo(() => {
    if (csvText.trim() === '') {
      return null;
    }

    try {
      return buildScheduleImportRows({
        csv: csvText,
        mapping,
        mode,
        targetMemberId,
        defaultCategory,
        startDate,
        endDate: endDate === '' ? null : endDate,
        existingEvents,
      });
    } catch (previewError) {
      return { error: previewError instanceof Error ? previewError.message : t('rowsWithErrors') };
    }
  }, [csvText, defaultCategory, endDate, existingEvents, mapping, mode, startDate, t, targetMemberId]);

  if (!isOpen) {
    return null;
  }

  const parsedRows = preview !== null && !('error' in preview)
    ? preview.rows.map((row) => ({ ...row, selected: row.selected && !deselectedRows.has(row.sourceRow) }))
    : [];
  const headers = preview !== null && !('error' in preview) ? preview.headers : [];
  const readyCount = parsedRows.filter((row) => row.selected && row.status !== 'invalid').length;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file === undefined) {
      return;
    }

    if (file.size > maxScheduleImportCsvBytes) {
      setError(t('csvFileTooLarge'));
      return;
    }

    setError(null);
    setResult(null);
    setDeselectedRows(new Set());
    setCsvText(await file.text());
  }

  function toggleRow(sourceRow: number) {
    if (preview === null || 'error' in preview) {
      return;
    }

    setDeselectedRows((currentRows) => {
      const nextRows = new Set(currentRows);

      if (nextRows.has(sourceRow)) {
        nextRows.delete(sourceRow);
      } else {
        nextRows.add(sourceRow);
      }

      return nextRows;
    });
  }

  async function handleImport() {
    if (preview === null || 'error' in preview || targetMemberId === '' || readyCount === 0) {
      setError(t('noValidRows'));
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const importResult = await onImport({
        targetMemberId,
        defaultCategory,
        mode,
        startDate: mode === 'weekly' ? startDate : undefined,
        endDate: mode === 'weekly' && endDate !== '' ? endDate : null,
        batchId: `csv-${Date.now().toString(36)}`,
        rows: parsedRows,
      });
      setResult(importResult);
    } catch {
      setError(t('sharedDataSaveError'));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="import-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="import-schedule-title">
        <header className="import-schedule-dialog__header">
          <div>
            <h2 id="import-schedule-title">{t('importSchedule')}</h2>
            <p>{t('uploadCsv')}</p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose}>{t('close')}</button>
        </header>

        <div className="import-schedule-dialog__body">
          <section className="import-schedule-dialog__controls">
            <label className="form-field">
              <span>{t('uploadCsv')}</span>
              <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFileChange(event)} />
            </label>
            <label className="form-field">
              <span>{t('chooseMember')}</span>
              <select value={targetMemberId} onChange={(event) => setTargetMemberId(event.target.value)}>
                {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>{t('defaultActivity')}</span>
              <select value={defaultCategory} onChange={(event) => setDefaultCategory(event.target.value as EventCategory)}>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>{getEventCategoryLabel({ category, customCategoryLabel: null }, language)}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>{t('importMode')}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as ScheduleImportMode)}>
                <option value="dated">{t('datedSchedule')}</option>
                <option value="weekly">{t('weeklyRecurring')}</option>
              </select>
            </label>
            {mode === 'weekly' ? (
              <>
                <label className="form-field">
                  <span>{t('startDate')}</span>
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="form-field">
                  <span>{t('recurrenceEnd')}</span>
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </>
            ) : null}
          </section>

          {preview !== null && !('error' in preview) ? (
            <section className="import-schedule-dialog__mapping">
              <h3>{t('mapColumns')}</h3>
              {importFields.map((field) => (
                <label className="form-field" key={field.key}>
                  <span>{t(field.translationKey)}</span>
                  <select
                    value={preview.mapping[field.key] ?? ''}
                    onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value || undefined })}
                  >
                    <option value="">-</option>
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </section>
          ) : null}

          {preview !== null && 'error' in preview ? <p className="add-event-form__error">{preview.error}</p> : null}
          {error !== null ? <p className="add-event-form__error">{error}</p> : null}
          {result !== null ? (
            <div className="import-schedule-dialog__result">
              <p>
                {t('importedSuccessfully')}: {result.created} · {t('skippedDuplicates')}: {result.duplicates} · {t('rowsWithErrors')}: {result.errors}
              </p>
              <button type="button" className="add-event-form__save" onClick={onClose}>{t('viewImportedSchedule')}</button>
            </div>
          ) : null}

          {parsedRows.length > 0 ? (
            <div className="import-schedule-dialog__preview" aria-label={t('preview')}>
              <table>
                <thead>
                  <tr>
                    <th>{t('selectedFilters')}</th>
                    <th>{t('status')}</th>
                    <th>{mode === 'weekly' ? t('daysFilter') : t('date')}</th>
                    <th>{t('startTime')}</th>
                    <th>{t('endTime')}</th>
                    <th>{t('members')}</th>
                    <th>{t('activityTypeFilter')}</th>
                    <th>{t('title')}</th>
                    <th>{t('location')}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => (
                    <tr key={row.sourceRow} data-status={row.status}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={row.status === 'invalid'}
                          onChange={() => toggleRow(row.sourceRow)}
                        />
                      </td>
                      <td>{t(statusTranslationKey(row.status))}</td>
                      <td>{mode === 'weekly' ? row.weekday ?? '-' : row.date ?? '-'}</td>
                      <td>{row.startTime || '-'}</td>
                      <td>{row.endTime ?? '-'}</td>
                      <td>{children.find((child) => child.id === targetMemberId)?.name ?? targetMemberId}</td>
                      <td>{getEventCategoryLabel({ category: row.category ?? defaultCategory, customCategoryLabel: null }, language)}</td>
                      <td>{row.title || '-'}</td>
                      <td>{row.location ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <footer className="import-schedule-dialog__actions">
          <button type="button" className="add-event-form__cancel" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="add-event-form__save" disabled={isImporting || readyCount === 0} onClick={() => void handleImport()}>
            {isImporting ? t('syncing') : t('importSelected')}
          </button>
        </footer>
      </section>
    </div>
  );
}

function statusTranslationKey(status: 'ready' | 'duplicate' | 'warning' | 'invalid') {
  return status === 'ready' ? 'ready' : status === 'duplicate' ? 'duplicate' : status === 'invalid' ? 'invalid' : 'warning';
}

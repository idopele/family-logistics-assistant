import { useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import type { Child, Event, EventCategory } from '../models';
import type { ScheduleImportResult } from '../services/sharedFamilyData';
import {
  buildScheduleImportRows,
  getDuplicateKeyForTarget,
  maxScheduleImportCsvBytes,
  type ColumnMapping,
  type ScheduleImportField,
  type ScheduleImportInputRow,
  type ScheduleImportMode,
} from '../services/scheduleImport';
import { addDays } from '../utils/dateTime';
import { isValidDate, isValidTime } from '../utils/dateTime';
import { getSundayOfWeek, parseWeeklyScheduleText } from '../services/weeklyScheduleTextParser';

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
    replaceWeekly?: boolean;
  }) => Promise<ScheduleImportResult>;
}

type ImportSourceMode = 'csv' | 'weeklyText';

const importFields: Array<{ key: ScheduleImportField; translationKey: 'date' | 'daysFilter' | 'startTime' | 'endTime' | 'title' | 'location' | 'notes' | 'activityTypeFilter' | 'homeTeam' | 'awayTeam' }> = [
  { key: 'date', translationKey: 'date' },
  { key: 'day', translationKey: 'daysFilter' },
  { key: 'startTime', translationKey: 'startTime' },
  { key: 'endTime', translationKey: 'endTime' },
  { key: 'title', translationKey: 'title' },
  { key: 'location', translationKey: 'location' },
  { key: 'notes', translationKey: 'notes' },
  { key: 'category', translationKey: 'activityTypeFilter' },
  { key: 'homeTeam', translationKey: 'homeTeam' },
  { key: 'awayTeam', translationKey: 'awayTeam' },
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
  const [sourceMode, setSourceMode] = useState<ImportSourceMode>('csv');
  const [csvText, setCsvText] = useState('');
  const [weeklyText, setWeeklyText] = useState('');
  const [targetMemberId, setTargetMemberId] = useState(children[0]?.id ?? '');
  const [defaultCategory, setDefaultCategory] = useState<EventCategory>(availableCategories[0] ?? 'basketball');
  const [mode, setMode] = useState<ScheduleImportMode>('dated');
  const [targetWeekStart, setTargetWeekStart] = useState(() => getSundayOfWeek(getLocalDateString()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rowOverrides, setRowOverrides] = useState<Record<number, Partial<Pick<ScheduleImportInputRow, 'date' | 'startTime' | 'endTime' | 'title' | 'location'>>>>({});
  const [replaceWeekly, setReplaceWeekly] = useState(true);
  const [deselectedRows, setDeselectedRows] = useState<Set<number>>(() => new Set());
  const [result, setResult] = useState<ScheduleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const preview = useMemo(() => {
    if (sourceMode === 'weeklyText') {
      if (weeklyText.trim() === '') {
        return null;
      }

      if (!isValidDate(targetWeekStart)) {
        return { error: t('invalidDate') };
      }

      const rows = applyDuplicateState(
        parseWeeklyScheduleText({
          text: weeklyText,
          targetWeekStart,
          defaultCategory,
        }).map((row) => applyRowOverride(row, rowOverrides[row.sourceRow])),
        targetMemberId,
        defaultCategory,
        existingEvents,
      );

      return { headers: [], mapping: {}, rows };
    }

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
  }, [csvText, defaultCategory, endDate, existingEvents, mapping, mode, rowOverrides, sourceMode, startDate, t, targetMemberId, targetWeekStart, weeklyText]);

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
    setRowOverrides({});
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
        startDate: sourceMode === 'weeklyText' ? targetWeekStart : mode === 'weekly' ? startDate : undefined,
        endDate: sourceMode === 'weeklyText' ? addDays(targetWeekStart, 6) : mode === 'weekly' && endDate !== '' ? endDate : null,
        batchId: `${sourceMode === 'weeklyText' ? 'whatsapp-weekly' : 'csv'}-${Date.now().toString(36)}`,
        rows: parsedRows,
        replaceWeekly: sourceMode === 'weeklyText' && replaceWeekly,
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
              <span>{t('importSource')}</span>
              <select
                value={sourceMode}
                onChange={(event) => {
                  setSourceMode(event.target.value as ImportSourceMode);
                  setResult(null);
                  setError(null);
                  setDeselectedRows(new Set());
                  setRowOverrides({});
                }}
              >
                <option value="csv">{t('csvFileSource')}</option>
                <option value="weeklyText">{t('pasteWeeklySchedule')}</option>
              </select>
            </label>
            {sourceMode === 'csv' ? (
              <label className="form-field">
                <span>{t('uploadCsv')}</span>
                <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFileChange(event)} />
              </label>
            ) : null}
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
            {sourceMode === 'csv' ? <label className="form-field">
              <span>{t('importMode')}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as ScheduleImportMode)}>
                <option value="dated">{t('datedSchedule')}</option>
                <option value="weekly">{t('weeklyRecurring')}</option>
              </select>
            </label> : null}
            {sourceMode === 'weeklyText' ? (
              <>
                <label className="form-field">
                  <span>{t('targetWeek')}</span>
                  <input type="date" value={targetWeekStart} onChange={(event) => event.target.value === '' ? setTargetWeekStart('') : setTargetWeekStart(getSundayOfWeek(event.target.value))} />
                </label>
                <label className="form-field import-schedule-dialog__wide-field">
                  <span>{t('pasteWeeklySchedule')}</span>
                  <textarea value={weeklyText} onChange={(event) => { setWeeklyText(event.target.value); setRowOverrides({}); }} rows={5} />
                </label>
                <label className="form-field import-schedule-dialog__checkbox-field">
                  <span>{t('updateWeeklySchedule')}</span>
                  <input type="checkbox" checked={replaceWeekly} onChange={(event) => setReplaceWeekly(event.target.checked)} />
                </label>
              </>
            ) : null}
            {sourceMode === 'csv' && mode === 'weekly' ? (
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

          {sourceMode === 'csv' && preview !== null && !('error' in preview) ? (
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
                    <th>{sourceMode === 'csv' && mode === 'weekly' ? t('daysFilter') : t('date')}</th>
                    <th>{t('startTime')}</th>
                    <th>{t('endTime')}</th>
                    <th>{t('members')}</th>
                    <th>{t('activityTypeFilter')}</th>
                    <th>{t('title')}</th>
                    <th>{t('location')}</th>
                    <th>{t('homeTeam')}</th>
                    <th>{t('awayTeam')}</th>
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
                      <td>{sourceMode === 'weeklyText' ? editableCell(row, 'date', setRowOverrides) : sourceMode === 'csv' && mode === 'weekly' ? row.weekday ?? '-' : row.date ?? '-'}</td>
                      <td>{sourceMode === 'weeklyText' ? editableCell(row, 'startTime', setRowOverrides) : row.startTime || '-'}</td>
                      <td>{sourceMode === 'weeklyText' ? editableCell(row, 'endTime', setRowOverrides) : row.endTime ?? '-'}</td>
                      <td>{children.find((child) => child.id === targetMemberId)?.name ?? targetMemberId}</td>
                      <td>{getEventCategoryLabel({ category: row.category ?? defaultCategory, customCategoryLabel: null }, language)}</td>
                      <td>{sourceMode === 'weeklyText' ? editableCell(row, 'title', setRowOverrides) : row.title || '-'}</td>
                      <td>{sourceMode === 'weeklyText' ? editableCell(row, 'location', setRowOverrides) : row.location ?? '-'}</td>
                      <td>{row.homeTeam ?? '-'}</td>
                      <td>{row.awayTeam ?? '-'}</td>
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

function getLocalDateString(): string {
  const now = new Date();

  return `${now.getFullYear().toString().padStart(4, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

function applyRowOverride(
  row: ScheduleImportInputRow,
  override: Partial<Pick<ScheduleImportInputRow, 'date' | 'startTime' | 'endTime' | 'title' | 'location'>> | undefined,
): ScheduleImportInputRow {
  if (override === undefined) {
    return row;
  }

  const nextRow: ScheduleImportInputRow = {
    ...row,
    ...override,
    location: override.location === '' ? null : override.location ?? row.location,
    endTime: override.endTime === '' ? null : override.endTime ?? row.endTime,
    messages: [],
    status: 'ready',
    selected: true,
  };

  if (nextRow.date === null || !isValidDate(nextRow.date)) {
    nextRow.status = 'invalid';
    nextRow.messages.push('Invalid date');
  }

  if (!isValidTime(nextRow.startTime)) {
    nextRow.status = 'invalid';
    nextRow.messages.push('Time required');
  }

  if (nextRow.endTime !== null && !isValidTime(nextRow.endTime)) {
    nextRow.status = 'invalid';
    nextRow.messages.push('Invalid end time');
  }

  if (nextRow.title.trim() === '') {
    nextRow.status = 'invalid';
    nextRow.messages.push('Missing title');
  }

  nextRow.selected = nextRow.status !== 'invalid';

  return nextRow;
}

function applyDuplicateState(
  rows: ScheduleImportInputRow[],
  targetMemberId: string,
  defaultCategory: EventCategory,
  existingEvents: Event[],
): ScheduleImportInputRow[] {
  const existingKeys = new Set(existingEvents.map((event) => {
    const dateOrDay = event.recurrence?.frequency === 'weekly'
      ? `w:${event.recurrence.daysOfWeek?.join(',') ?? ''}`
      : `d:${event.date ?? ''}`;

    return [event.childId, dateOrDay, event.startTime, normalizeImportText(event.title), event.category].join('|');
  }));

  return rows.map((row) => {
    const duplicateKey = getDuplicateKeyForTarget(row, targetMemberId, defaultCategory);

    if (row.status !== 'invalid' && duplicateKey !== null && existingKeys.has(duplicateKey)) {
      return {
        ...row,
        status: 'duplicate',
        selected: false,
        messages: [...row.messages, 'A similar event already exists'],
      };
    }

    return row;
  });
}

function editableCell(
  row: ScheduleImportInputRow,
  field: 'date' | 'startTime' | 'endTime' | 'title' | 'location',
  setRowOverrides: Dispatch<SetStateAction<Record<number, Partial<Pick<ScheduleImportInputRow, 'date' | 'startTime' | 'endTime' | 'title' | 'location'>>>>>,
) {
  const value = row[field] ?? '';
  const inputType = field === 'date' ? 'date' : field === 'startTime' || field === 'endTime' ? 'time' : 'text';

  return (
    <input
      className="import-schedule-dialog__table-input"
      type={inputType}
      value={value}
      onChange={(event) => {
        const nextValue = event.target.value;
        setRowOverrides((current) => ({
          ...current,
          [row.sourceRow]: {
            ...current[row.sourceRow],
            [field]: nextValue,
          },
        }));
      }}
    />
  );
}

function normalizeImportText(value: string): string {
  return value.trim().toLowerCase().replace(/["'׳´]/gu, '').replace(/\s+/gu, ' ');
}

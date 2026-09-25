import type { CalendarSourceSettings, EducationSector, SchoolLevel } from '../models';
import { useUiPreferences } from '../i18n';

interface CalendarSourceControlsProps {
  settings: CalendarSourceSettings;
  canManage: boolean;
  isSaving: boolean;
  onChange: (settings: CalendarSourceSettings) => void;
  onRefresh: () => void;
}

export function CalendarSourceControls({
  settings,
  canManage,
  isSaving,
  onChange,
  onRefresh,
}: CalendarSourceControlsProps) {
  const { t } = useUiPreferences();

  function update(nextSettings: CalendarSourceSettings) {
    if (!canManage) {
      return;
    }

    onChange({ ...nextSettings, updatedAt: new Date().toISOString() });
  }

  return (
    <section className="calendar-sources" aria-label={t('calendarSources')}>
      <header className="calendar-sources__header">
        <div>
          <h2>{t('calendarSources')}</h2>
          <p>{t('calendarSourcesHelp')}</p>
        </div>
        {canManage ? (
          <button type="button" onClick={onRefresh} disabled={isSaving}>
            {t('refreshSources')}
          </button>
        ) : null}
      </header>

      <div className="calendar-sources__grid">
        <label className="calendar-source-toggle">
          <input
            type="checkbox"
            checked={settings.israel_holidays.enabled}
            disabled={!canManage || isSaving}
            onChange={(event) =>
              update({
                ...settings,
                israel_holidays: { ...settings.israel_holidays, enabled: event.target.checked },
              })
            }
          />
          <span>{t('israelHolidaysSource')}</span>
          <small>{t('hebcalIsraelCalendar')}</small>
        </label>

        <label className="calendar-source-toggle">
          <input
            type="checkbox"
            checked={settings.moe_school_vacations.enabled}
            disabled={!canManage || isSaving}
            onChange={(event) =>
              update({
                ...settings,
                moe_school_vacations: { ...settings.moe_school_vacations, enabled: event.target.checked },
              })
            }
          />
          <span>{t('moeVacationsSource')}</span>
          <small>{t('moeProfileSummary')}</small>
        </label>

        <label className="calendar-source-toggle">
          <input
            type="checkbox"
            checked={settings.israel_holidays.includeMinorObservances}
            disabled={!canManage || isSaving}
            onChange={(event) =>
              update({
                ...settings,
                israel_holidays: { ...settings.israel_holidays, includeMinorObservances: event.target.checked },
              })
            }
          />
          <span>{t('minorObservances')}</span>
          <small>{t('minorObservancesHelp')}</small>
        </label>
      </div>

      <div className="calendar-sources__metadata">
        <span>Hebcal · {t('israelCalendarMode')}</span>
        <span>{t('ministryOfEducation')} · {settings.moe_school_vacations.schoolYear}</span>
        <span>{t('sourceLastVerified')}: 2026-09-02</span>
      </div>

      {canManage ? (
        <div className="calendar-sources__settings">
          <label>
            <span>{t('schoolYear')}</span>
            <select
              value={settings.moe_school_vacations.schoolYear}
              disabled={isSaving}
              onChange={(event) =>
                update({
                  ...settings,
                  moe_school_vacations: { ...settings.moe_school_vacations, schoolYear: event.target.value },
                })
              }
            >
              <option value="2026-2027">2026-2027</option>
            </select>
          </label>
          <label>
            <span>{t('educationSector')}</span>
            <select
              value={settings.moe_school_vacations.profile.sector}
              disabled={isSaving}
              onChange={(event) =>
                update({
                  ...settings,
                  moe_school_vacations: {
                    ...settings.moe_school_vacations,
                    profile: { ...settings.moe_school_vacations.profile, sector: event.target.value as EducationSector },
                  },
                })
              }
            >
              <option value="jewish_official">{t('jewishOfficialEducation')}</option>
              <option value="arab_official">{t('arabOfficialEducation')}</option>
              <option value="druze_official">{t('druzeOfficialEducation')}</option>
              <option value="recognized_non_official">{t('recognizedNonOfficialEducation')}</option>
            </select>
          </label>
          <label>
            <span>{t('schoolLevel')}</span>
            <select
              value={settings.moe_school_vacations.profile.level}
              disabled={isSaving}
              onChange={(event) =>
                update({
                  ...settings,
                  moe_school_vacations: {
                    ...settings.moe_school_vacations,
                    profile: { ...settings.moe_school_vacations.profile, level: event.target.value as SchoolLevel },
                  },
                })
              }
            >
              <option value="kindergarten">{t('kindergarten')}</option>
              <option value="primary">{t('primarySchool')}</option>
              <option value="middle_school">{t('middleSchool')}</option>
              <option value="high_school">{t('highSchool')}</option>
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}

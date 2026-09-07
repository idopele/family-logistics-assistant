import { useState, type FormEvent } from 'react';
import { useUiPreferences } from '../i18n';
import type { Child } from '../models';

interface AddChildDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (child: Child) => void;
}

const childColorOptions = ['#7C3AED', '#0F766E', '#EA580C', '#0891B2', '#4F46E5', '#BE123C'];

export function AddChildDialog({ isOpen, onClose, onSave }: AddChildDialogProps) {
  const { t } = useUiPreferences();
  const [name, setName] = useState('');
  const [color, setColor] = useState(childColorOptions[0]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim() === '') {
      setError(t('childNameRequired'));
      return;
    }

    onSave({
      id: createChildId(),
      name: name.trim(),
      color,
      isActive: true,
    });

    setName('');
    setColor(childColorOptions[0]);
    setError(null);
  }

  function handleCancel() {
    setName('');
    setColor(childColorOptions[0]);
    setError(null);
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="add-event-dialog" role="dialog" aria-modal="true" aria-labelledby="add-child-title">
        <header className="add-event-dialog__header">
          <h2 id="add-child-title">{t('addChildTitle')}</h2>
        </header>
        <form className="add-event-form" onSubmit={handleSubmit}>
          <label className="form-field form-field--wide">
            <span>{t('childName')}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <fieldset className="color-field form-field--wide">
            <legend>{t('color')}</legend>
            <div className="color-options">
              {childColorOptions.map((option) => (
                <button
                  className="color-option"
                  data-selected={color === option ? 'true' : 'false'}
                  key={option}
                  style={{ backgroundColor: option }}
                  type="button"
                  aria-label={`${t('chooseColor')} ${option}`}
                  onClick={() => setColor(option)}
                />
              ))}
            </div>
          </fieldset>

          {error !== null ? <p className="add-event-form__error">{error}</p> : null}

          <div className="add-event-form__actions">
            <button className="add-event-form__save" type="submit">
              {t('saveChild')}
            </button>
            <button className="add-event-form__cancel" type="button" onClick={handleCancel}>
              {t('cancel')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function createChildId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-child-${crypto.randomUUID()}`;
  }

  return `custom-child-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

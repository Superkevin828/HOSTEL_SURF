import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const DialogContext = createContext(null);

const emptyValues = (fields) =>
  fields.reduce((values, field) => {
    values[field.name] = field.value === undefined ? '' : field.value;
    return values;
  }, {});

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [values, setValues] = useState({});

  useEffect(() => {
    if (dialog && dialog.kind === 'form') setValues(emptyValues(dialog.options.fields || []));
  }, [dialog]);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setDialog({ kind: 'confirm', options, resolve });
      }),
    []
  );

  const form = useCallback(
    (options) =>
      new Promise((resolve) => {
        setDialog({ kind: 'form', options, resolve });
      }),
    []
  );

  const close = (result) => {
    if (!dialog) return;
    dialog.resolve(result);
    setDialog(null);
  };

  const submit = (event) => {
    event.preventDefault();
    const fields = dialog.options.fields || [];
    const missing = fields.find((field) => {
      if (!field.required) return false;
      const value = values[field.name];
      return value === '' || value === undefined || value === null;
    });
    if (missing) return;
    close(values);
  };

  return (
    <DialogContext.Provider value={{ confirm, form }}>
      {children}
      {dialog ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close(null)}>
          <div className="modal dlg" role="dialog" aria-modal="true">
            {dialog.kind === 'confirm' ? (
              <div className="dlg-body">
                <h3>{dialog.options.title}</h3>
                {dialog.options.text ? <p className="muted">{dialog.options.text}</p> : null}
                <div className="dlg-actions">
                  <button className="btn btn-ghost" type="button" onClick={() => close(false)}>
                    Cancel
                  </button>
                  <button
                    className={`btn ${dialog.options.danger ? 'btn-danger' : 'btn-solid'}`}
                    type="button"
                    onClick={() => close(true)}
                  >
                    {dialog.options.ok || 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <form className="dlg-body" onSubmit={submit}>
                <h3>{dialog.options.title}</h3>
                {dialog.options.note ? <p className="muted">{dialog.options.note}</p> : null}
                {(dialog.options.fields || []).map((field) => (
                  <div className="field" key={field.name}>
                    <label htmlFor={`dlg-${field.name}`}>{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        id={`dlg-${field.name}`}
                        value={values[field.name] || ''}
                        required={field.required}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      >
                        <option value="">{field.placeholder || 'Choose'}</option>
                        {(field.options || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`dlg-${field.name}`}
                        type={field.type || 'text'}
                        value={values[field.name] || ''}
                        required={field.required}
                        minLength={field.minLength}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      />
                    )}
                    {field.hint ? <span className="hint">{field.hint}</span> : null}
                  </div>
                ))}
                <div className="dlg-actions">
                  <button className="btn btn-ghost" type="button" onClick={() => close(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-solid" type="submit">
                    {dialog.options.ok || 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used inside DialogProvider');
  return value;
}

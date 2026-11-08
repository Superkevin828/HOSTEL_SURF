import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message, kind = '') => {
      const id = ++idRef.current;
      setItems((current) => [...current, { id, message, kind, leaving: false }]);
      const delay = kind === 'err' ? 5500 : 3200;
      setTimeout(() => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
        setTimeout(() => remove(id), 260);
      }, delay);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.kind} ${item.leaving ? 'out' : ''}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

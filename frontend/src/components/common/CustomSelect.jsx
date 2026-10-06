import React, { useState, useRef, useEffect } from 'react';

/**
 * Custom in-DOM Select Component
 * Bypasses Chrome/Linux Wayland native OS select popup bugs (where native select
 * dropdowns get clipped to ~35px height by the OS compositor and fail to open).
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  className = '',
  id,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (optValue) => {
    if (onChange) {
      // Support both direct value and standard synthetic event object
      onChange({ target: { value: optValue } });
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-10 px-3 bg-slate-100 hover:bg-slate-200/70 text-text text-sm rounded-lg flex items-center justify-between transition-colors border ${
          isOpen ? 'border-primary ring-2 ring-primary/20 bg-white' : 'border-transparent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} text-left`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${!selectedOption && !value ? 'text-text-muted' : 'text-text'}`}>
          {displayText}
        </span>
        <span
          className={`material-symbols-outlined text-text-muted text-[20px] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-surface border border-border rounded-lg shadow-xl py-1 text-sm animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '100%' }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-text-muted text-xs">No options available</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={String(opt.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-primary-soft text-primary font-medium'
                      : 'text-text hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0 ml-2">
                      check
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

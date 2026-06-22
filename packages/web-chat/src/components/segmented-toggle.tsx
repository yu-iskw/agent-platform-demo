'use client';

import { segmentedButtonStyle } from '@/lib/ui-tokens';

type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedToggleProps<T extends string> = {
  options: SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: SegmentedToggleProps<T>): React.JSX.Element {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', width: '100%' }}>
      {options.map((option, index) => {
        const selected = value === option.value;
        const style = segmentedButtonStyle(selected);
        if (index === 0) {
          style.borderTopLeftRadius = 4;
          style.borderBottomLeftRadius = 4;
          style.borderRight = 'none';
        } else if (index === options.length - 1) {
          style.borderTopRightRadius = 4;
          style.borderBottomRightRadius = 4;
        } else {
          style.borderRight = 'none';
        }

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            style={style}
            onClick={() => {
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

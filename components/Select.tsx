import * as SelectPrimitive from '@radix-ui/react-select';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps<T> {
  options: T[];
  renderOption: (option: T) => React.ReactNode;
  onSelect: (option: T) => void;
  isSelected: (option: T) => boolean;
  value: string | null | undefined;
  placeholder?: string;
  disabled?: boolean;
  /** Stable unique key per option (avoids duplicate keys when labels repeat). */
  getOptionKey?: (option: T, index: number) => string;
}

export function Select<T>(props: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectPrimitive.Root disabled={props.disabled} open={isOpen} onOpenChange={setIsOpen}>
      <SelectPrimitive.Trigger className="flex h-10 min-h-[40px] w-full cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-primary outline-none transition-shadow focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:opacity-50">
        <div className={props.value ? 'text-primary' : 'text-tertiary'}>
          {props.value ? props.value : props.placeholder}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-secondary" strokeWidth={1.75} aria-hidden />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-50 w-[var(--radix-select-trigger-width)] max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-primary shadow-lg"
          position="popper"
          sideOffset={5}
        >
          <SelectPrimitive.Viewport className="py-1">
            {props.options.map((option, index) => {
              const isSelected = props.isSelected(option);
              const rowKey = props.getOptionKey
                ? props.getOptionKey(option, index)
                : `opt-${index}-${String(props.renderOption(option))}`;

              return (
                <div
                  key={rowKey}
                  className={`cursor-pointer px-3 py-2.5 text-sm outline-none transition-colors ${
                    isSelected ? 'bg-brand-50 text-brand-600' : 'text-secondary hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    props.onSelect(option);
                    setIsOpen(false);
                  }}
                >
                  {props.renderOption(option)}
                </div>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

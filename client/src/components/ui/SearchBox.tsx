import React from 'react';
import { Search } from 'lucide-react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** For server-backed searches: called on Enter. Omit for filter-as-you-type. */
  onSubmit?: () => void;
  placeholder: string;
}

/** Per-page table search input, rendered under the page title. */
const SearchBox: React.FC<SearchBoxProps> = ({ value, onChange, onSubmit, placeholder }) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit?.();
    }}
    className="inline-flex items-center gap-2 bg-surface rounded-input px-3 py-2 border border-text-disabled focus-within:border-primary/40 shadow-level1"
  >
    <Search className="h-4 w-4 text-text-muted flex-shrink-0" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-transparent border-none text-secondary outline-none placeholder:text-text-muted text-sm w-56 focus:w-72 transition-all duration-300"
    />
  </form>
);

export default SearchBox;

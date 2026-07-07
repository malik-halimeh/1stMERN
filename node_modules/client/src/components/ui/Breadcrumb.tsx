import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="w-full py-2 px-4 bg-background border-b border-dashboard-section-bg font-sans select-none">
      <ol className="flex items-center gap-2 text-secondary text-sm">
        <li className="flex items-center">
          <a
            href="/"
            className="text-text-muted hover:text-text-secondary flex items-center transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </a>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-text-muted flex-shrink-0" />
              {isLast || !item.href ? (
                <span className="text-text-primary font-medium truncate max-w-[200px]" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-text-muted hover:text-text-secondary transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;

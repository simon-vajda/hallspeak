import { DEFAULT_PAGE_TITLE } from '@hallspeak/contract/page-titles';
import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;

    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [title]);
}

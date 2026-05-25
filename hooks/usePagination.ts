import { useMemo } from 'react';

interface UsePaginationProps<T> {
  data: T[];
  currentPage: number;
  pageSize: number;
}

export function usePagination<T>({ data, currentPage, pageSize }: UsePaginationProps<T>) {
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return {
    paginatedData,
    totalPages,
    hasNextPage,
    hasPrevPage,
    startIndex: (currentPage - 1) * pageSize + 1,
    endIndex: Math.min(currentPage * pageSize, data.length),
    totalItems: data.length,
  };
}

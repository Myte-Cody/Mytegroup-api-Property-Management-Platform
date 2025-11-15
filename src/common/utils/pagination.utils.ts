/**
 * Generic paginated response interface
 */
export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Creates an empty paginated response
 * @param page Current page number (default: 1)
 * @param limit Items per page (default: 10)
 * @returns Empty paginated response
 */
export const createEmptyPaginatedResponse = <T = any>(
  page: number = 1,
  limit: number = 10,
): PaginatedResponse<T> => ({
  data: [],
  total: 0,
  page,
  limit,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
});

/**
 * Creates a paginated response from data and pagination info
 * @param data Array of items
 * @param total Total number of items
 * @param page Current page number
 * @param limit Items per page
 * @returns Paginated response
 */
export const createPaginatedResponse = <T = any>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
};

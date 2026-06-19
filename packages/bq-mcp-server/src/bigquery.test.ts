import { describe, expect, it } from 'vitest';

import { mapBigQueryListError } from './bigquery.js';

describe('mapBigQueryListError', () => {
  it('maps 403 to permission_denied', () => {
    expect(mapBigQueryListError({ code: 403, message: 'Access Denied: project x' })).toEqual({
      status: 'permission_denied',
      error: 'Access Denied: project x',
    });
  });

  it('maps 404 to project_not_found', () => {
    expect(mapBigQueryListError({ code: 404, message: 'Not found: Project missing' })).toEqual({
      status: 'project_not_found',
      error: 'Not found: Project missing',
    });
  });

  it('maps unknown errors to error', () => {
    expect(mapBigQueryListError(new Error('timeout'))).toEqual({
      status: 'error',
      error: 'timeout',
    });
  });
});

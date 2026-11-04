import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/ApiError';
import { isServerDown } from './OutageOverlay';

describe('isServerDown', () => {
  it('is true when the server cannot be reached', () => {
    expect(isServerDown(new ApiError(0, 'NETWORK_ERROR'))).toBe(true);
    expect(isServerDown(new ApiError(502, 'UNKNOWN'))).toBe(true);
  });

  it('is false for an answer from the app, or no error', () => {
    expect(isServerDown(new ApiError(401, 'UNKNOWN'))).toBe(false);
    expect(isServerDown(new ApiError(500, 'UNKNOWN'))).toBe(false);
    expect(isServerDown(null)).toBe(false);
  });
});

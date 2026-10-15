import { describe, expect, it } from 'vitest';
import {
  csvRowNumberOf,
  sourceHashOf,
} from '../src/modules/appointments/AppointmentBookingService.js';

const CSV = 'a'.repeat(64);
const PDF = 'b'.repeat(64);

describe('sourceHashOf', () => {
  it('is empty for manual entry', () => {
    expect(sourceHashOf([], null)).toBeNull();
  });

  it('does not depend on the order of the files', () => {
    expect(sourceHashOf([CSV, PDF], null)).toBe(sourceHashOf([PDF, CSV], null));
  });

  it('tells rows of the same CSV apart', () => {
    expect(sourceHashOf([CSV], 'row:0')).not.toBe(sourceHashOf([CSV], 'row:1'));
  });

  it('tells CSV only apart from CSV + PDF', () => {
    expect(sourceHashOf([CSV], null)).not.toBe(sourceHashOf([CSV, PDF], null));
  });
});

describe('csvRowNumberOf', () => {
  it('turns the 0-based data row into the row number in the file (header = 1)', () => {
    expect(csvRowNumberOf('row:0')).toBe(2);
    expect(csvRowNumberOf('row:12')).toBe(14);
  });

  it('is null when no row was chosen', () => {
    expect(csvRowNumberOf(null)).toBeNull();
    expect(csvRowNumberOf(undefined)).toBeNull();
    expect(csvRowNumberOf('something')).toBeNull();
  });
});

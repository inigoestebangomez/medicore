// apps/api/src/domain/import/column-mapping.vo.spec.ts
import { describe, it, expect } from '@jest/globals';
import { ColumnMappingVO } from './column-mapping.vo';
import type { ColumnMapping } from '@medicore/contracts';

describe('ColumnMappingVO', () => {
  const mapping: ColumnMapping = {
    'Nº HISTORIA': 'nhc',
    'Edad': 'age',
    'Telefono': 'ignore',     // BR-IMP-007 phone exclusion
    'Abordaje': 'custom',
  };

  it('should expose ignored columns (phone fields per BR-IMP-007)', () => {
    const vo = new ColumnMappingVO(mapping);
    expect(vo.ignoredColumns).toEqual(['Telefono']);
  });

  it('should expose standard-mapped columns', () => {
    const vo = new ColumnMappingVO(mapping);
    expect(vo.standardMapped).toEqual([
      { column: 'Nº HISTORIA', field: 'nhc' },
      { column: 'Edad', field: 'age' },
    ]);
  });

  it('should expose custom-mapped columns', () => {
    const vo = new ColumnMappingVO(mapping);
    expect(vo.customMapped).toEqual(['Abordaje']);
  });

  it('should detect junk rows by index', () => {
    const vo = new ColumnMappingVO({}, {}, [2, 5, 8]);
    expect(vo.isJunkRow(5)).toBe(true);
    expect(vo.isJunkRow(3)).toBe(false);
    // defensive copy preserved + sorted
    expect(vo.junkRowIndices).toEqual([2, 5, 8]);
  });

  it('should compare equality by value', () => {
    const a = new ColumnMappingVO({ X: 'nhc' }, { X: 'Nombre' }, [1]);
    const b = new ColumnMappingVO({ X: 'nhc' }, { X: 'Nombre' }, [1]);
    const c = new ColumnMappingVO({ X: 'age' });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
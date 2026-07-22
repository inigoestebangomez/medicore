// apps/api/src/domain/research/filter.vo.ts
// Value object: Filter — an individual filter condition in a ResearchQuery.
// Source-aware: imported filters operate on Patient.importedData JSONB; standard
// filters map to typed Patient columns; consultation/surgery/medication/scale
// filters map to relation `some:` queries (spec §8-9).

import type {
  FieldSource,
  FilterOperator,
  Filter as FilterDTO,
} from '@medicore/contracts';

export { FieldSource, FilterOperator };

const NUMERIC_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  'greater_than',
  'less_than',
  'between',
]);

const COMPARISON_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  'greater_than',
  'less_than',
  'between',
  'date_before',
  'date_after',
  'date_between',
]);

const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  'is_empty',
  'is_not_empty',
  'boolean_true',
  'boolean_false',
]);

/**
 * Value object representing a single filter. Enforces field/operator invariants:
 * - valueless operators must not carry a `value`
 * - `between`/`date_between` require `valueTo`
 * - `imported` source with numeric operators flags JSONB raw-SQL territory
 */
export class FilterVO {
  readonly field: string;
  readonly source: FieldSource;
  readonly operator: FilterOperator;
  readonly value: string | number | boolean | string[] | undefined;
  readonly valueTo: string | number | undefined;

  private constructor(props: FilterDTO) {
    this.field = props.field;
    this.source = props.source;
    this.operator = props.operator;
    this.value = props.value;
    this.valueTo = props.valueTo;
  }

  static create(props: FilterDTO): FilterVO {
    // valueless operators reject a value
    if (VALUELESS_OPERATORS.has(props.operator) && props.value !== undefined) {
      throw new Error(
        `Filter operator "${props.operator}" must not include a value`,
      );
    }

    // between / date_between require valueTo
    if (
      (props.operator === 'between' || props.operator === 'date_between') &&
      props.valueTo === undefined
    ) {
      throw new Error(
        `Filter operator "${props.operator}" requires a valueTo`,
      );
    }

    // All other operators (except valueless) require a value
    if (
      !VALUELESS_OPERATORS.has(props.operator) &&
      props.value === undefined
    ) {
      throw new Error(
        `Filter operator "${props.operator}" requires a value`,
      );
    }

    return new FilterVO(props);
  }

  /** Whether this filter needs a raw SQL escape hatch (AD-3). */
  get needsRawSql(): boolean {
    return (
      this.source === 'imported' &&
      (NUMERIC_OPERATORS.has(this.operator) ||
        COMPARISON_OPERATORS.has(this.operator))
    );
  }

  toDTO(): FilterDTO {
    return {
      field: this.field,
      source: this.source,
      operator: this.operator,
      value: this.value,
      valueTo: this.valueTo,
    };
  }
}
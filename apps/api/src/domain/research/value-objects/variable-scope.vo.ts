// apps/api/src/domain/research/value-objects/variable-scope.vo.ts
// Value object: VariableScope — CORE (always present, never required) vs
// CUSTOM (study-specific) — doc 07 §2.2 / REQ-FB-003.

export type VariableScopeLiteral = 'CORE' | 'CUSTOM';

export class VariableScopeVO {
  private constructor(public readonly value: VariableScopeLiteral) {}

  static create(value: string): VariableScopeVO {
    if (value !== 'CORE' && value !== 'CUSTOM') {
      throw new Error(`invalid_variable_scope: ${value}`);
    }
    return new VariableScopeVO(value);
  }

  get isCore(): boolean {
    return this.value === 'CORE';
  }

  equals(other: VariableScopeVO): boolean {
    return this.value === other.value;
  }
}
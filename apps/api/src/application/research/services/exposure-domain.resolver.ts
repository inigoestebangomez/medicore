// apps/api/src/application/research/services/exposure-domain.resolver.ts
// Resolves exposure domain (diagnosis/treatment/surgery/procedure) to cohort
// element IDs. Requires ≥2 valid elements for a comparison to be possible.
// The resolver maps domain names to the canonical source fields in the patient
// imported data and returns the distinct element values present in the cohort.

import { Injectable } from '@nestjs/common';

export type ExposureDomain = 'diagnosis' | 'treatment' | 'surgery' | 'procedure';

export interface ExposureElement {
  elementId: string;
  label: string;
  count: number;
}

export interface ExposureResolution {
  domain: ExposureDomain;
  elements: ExposureElement[];
  sourceField: string;
}

// Maps domain names to the JSONB source fields where element values live.
// Open question (design): confirm the canonical source fields and labels for
// diagnosis, treatment, surgery, and procedure element resolution.
const DOMAIN_SOURCE_FIELDS: Record<ExposureDomain, string> = {
  diagnosis: 'diagnoses',
  treatment: 'treatments',
  surgery: 'surgeries',
  procedure: 'procedures',
};

const VALID_DOMAINS: ExposureDomain[] = ['diagnosis', 'treatment', 'surgery', 'procedure'];

@Injectable()
export class ExposureDomainResolver {
  /**
   * Resolve exposure elements from cohort rows for a given domain.
   * Returns the distinct elements found and their counts.
   * Throws if the domain is invalid or fewer than 2 elements are found.
   */
  resolve(
    domain: string,
    rows: Array<Record<string, unknown>>,
    requestedElementIds?: string[],
  ): ExposureResolution {
    if (!VALID_DOMAINS.includes(domain as ExposureDomain)) {
      throw new Error(`Invalid exposure domain: ${domain}. Must be one of: ${VALID_DOMAINS.join(', ')}`);
    }

    const sourceField = DOMAIN_SOURCE_FIELDS[domain as ExposureDomain];
    const elementCounts = new Map<string, { label: string; count: number }>();

    for (const row of rows) {
      const fieldValue = row[sourceField];
      if (!fieldValue) continue;

      // Field can be an array of objects with { code, label } or plain strings
      const elements = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      for (const el of elements) {
        const elementId = this.extractElementId(el);
        if (!elementId) continue;

        // If specific elements were requested, filter to those
        if (requestedElementIds && requestedElementIds.length > 0) {
          if (!requestedElementIds.includes(elementId)) continue;
        }

        const existing = elementCounts.get(elementId);
        if (existing) {
          existing.count++;
        } else {
          elementCounts.set(elementId, {
            label: this.extractElementLabel(el, elementId),
            count: 1,
          });
        }
      }
    }

    const elements: ExposureElement[] = Array.from(elementCounts.entries()).map(
      ([elementId, { label, count }]) => ({ elementId, label, count }),
    );

    if (elements.length < 2) {
      throw new Error(
        `Insufficient exposure elements for domain '${domain}': found ${elements.length}, need ≥2 for comparison.`,
      );
    }

    return { domain: domain as ExposureDomain, elements, sourceField };
  }

  private extractElementId(el: unknown): string | null {
    if (typeof el === 'string') return el;
    if (typeof el === 'object' && el !== null) {
      const obj = el as Record<string, unknown>;
      return (obj.code ?? obj.id ?? obj.elementId ?? obj.name) as string | null;
    }
    return null;
  }

  private extractElementLabel(el: unknown, fallback: string): string {
    if (typeof el === 'string') return el;
    if (typeof el === 'object' && el !== null) {
      const obj = el as Record<string, unknown>;
      return (obj.label ?? obj.name ?? obj.description ?? fallback) as string;
    }
    return fallback;
  }
}

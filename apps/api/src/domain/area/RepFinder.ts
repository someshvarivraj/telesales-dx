import { CURRENT_CUSTOMER_TYPE } from '@telesales/shared';

export interface AreaRule {
  id: string;
  prefecture: string;
  city: string | null;
  customerTypeCondition: 'CURRENT' | 'NOT_CURRENT' | null;
  companyGroupId: string | null;
  salesRepId: string;
  backupRepId: string | null;
  webOnly: boolean;
  validFrom: string;
  validTo: string | null;
}

export interface RepQuery {
  prefecture: string | null;
  city: string | null;
  customerType: string | null;
  companyGroupId: string | null;
  /** 'YYYY-MM-DD' the rule must be valid on. */
  date: string;
}

/**
 * Finds the rep from the sales area table (spec §7): area (prefecture, city) +
 * customer type (current client or not) + specific company groups.
 * The most specific matching rule wins; the telemarketer can still choose someone else.
 */
export class RepFinder {
  constructor(private readonly rules: readonly AreaRule[]) {}

  find(query: RepQuery): AreaRule | null {
    let best: { rule: AreaRule; score: number } | null = null;
    for (const rule of this.rules) {
      const score = this.score(rule, query);
      if (score !== null && (!best || score > best.score)) {
        best = { rule, score };
      }
    }
    return best?.rule ?? null;
  }

  /** null = the rule does not apply. Higher = more specific. */
  private score(rule: AreaRule, query: RepQuery): number | null {
    if (rule.validFrom > query.date || (rule.validTo !== null && rule.validTo < query.date)) {
      return null;
    }
    let score = 0;

    if (rule.companyGroupId) {
      if (rule.companyGroupId !== query.companyGroupId) {
        return null;
      }
      score += 100;
    }

    if (rule.prefecture !== query.prefecture) {
      // A company-group rule applies wherever the office is.
      if (!rule.companyGroupId) {
        return null;
      }
    } else {
      score += 1;
      if (rule.city) {
        if (!query.city || !query.city.startsWith(rule.city)) {
          return null;
        }
        score += 10;
      }
    }

    if (rule.customerTypeCondition) {
      const isCurrent = query.customerType === CURRENT_CUSTOMER_TYPE;
      const wantsCurrent = rule.customerTypeCondition === 'CURRENT';
      if (isCurrent !== wantsCurrent) {
        return null;
      }
      score += 5;
    }
    return score;
  }
}

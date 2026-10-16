import type { QuoteBatch, QuoteTarget } from '../../domain/types'

export interface QuoteProvider {
  readonly kind: 'mis' | 'yahoo'
  fetchQuotes(targets: QuoteTarget[]): Promise<QuoteBatch>
}

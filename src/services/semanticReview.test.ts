import { describe, expect, it } from 'vitest'
import { validateSemanticReviewResponse } from './semanticReview'

describe('semantic review response contract', () => {
  it('accepts a bounded evidence-backed draft', () => {
    expect(validateSemanticReviewResponse({
      suggestedScore: 1,
      confidence: 0.78,
      evidence: '回答表达了饮水需求，但需要一次追问。',
      followUp: '您想喝温水还是凉水？',
      safetyFlags: [],
      modelId: 'provider-model-version',
    })).toEqual({
      suggestedScore: 1,
      confidence: 0.78,
      evidence: '回答表达了饮水需求，但需要一次追问。',
      followUp: '您想喝温水还是凉水？',
      safetyFlags: [],
      modelId: 'provider-model-version',
    })
  })

  it('rejects an unbounded score or missing evidence', () => {
    expect(() => validateSemanticReviewResponse({
      suggestedScore: 4,
      confidence: 0.9,
      evidence: '',
      followUp: null,
      safetyFlags: [],
      modelId: 'provider-model-version',
    })).toThrow()
  })

  it('allows refusal to score when human review is required', () => {
    const result = validateSemanticReviewResponse({
      suggestedScore: null,
      confidence: 0.44,
      evidence: '转写内容不足以判断回答含义。',
      followUp: null,
      safetyFlags: ['低置信度'],
      modelId: 'provider-model-version',
    })

    expect(result.suggestedScore).toBeNull()
    expect(result.safetyFlags).toContain('低置信度')
  })
})

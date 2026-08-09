import type { LanguageBackground, TaskScore } from '../types'

export const SEMANTIC_REVIEW_CONTRACT_VERSION = 'GYZJ-AI-DRAFT-1'

export interface SemanticReviewRequest {
  taskId: string
  itemId: string | null
  prompt: string
  responseText: string
  levels: [string, string, string, string]
  languageBackground: LanguageBackground
}

export interface SemanticReviewResult {
  suggestedScore: TaskScore
  confidence: number
  evidence: string
  followUp: string | null
  safetyFlags: string[]
  modelId: string
}

export function semanticReviewConfigured() {
  return Boolean(import.meta.env.VITE_LLM_ENDPOINT?.trim())
}

export function validateSemanticReviewResponse(value: unknown): SemanticReviewResult {
  if (!value || typeof value !== 'object') throw new Error('语义复核返回格式错误')
  const record = value as Record<string, unknown>
  const score = record.suggestedScore
  const confidence = record.confidence
  const evidence = record.evidence
  const followUp = record.followUp
  const safetyFlags = record.safetyFlags
  const modelId = record.modelId

  const validScore = score === null
    || (Number.isInteger(score) && Number(score) >= 0 && Number(score) <= 3)
  if (!validScore) throw new Error('语义复核分档超出允许范围')
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error('语义复核置信度无效')
  }
  if (typeof evidence !== 'string' || evidence.trim().length === 0) {
    throw new Error('语义复核缺少可核对证据')
  }
  if (followUp !== null && typeof followUp !== 'string') {
    throw new Error('语义复核追问格式无效')
  }
  if (!Array.isArray(safetyFlags) || safetyFlags.some((flag) => typeof flag !== 'string')) {
    throw new Error('语义复核安全标记格式无效')
  }
  if (typeof modelId !== 'string' || modelId.trim().length === 0) {
    throw new Error('语义复核缺少模型版本')
  }

  return {
    suggestedScore: score as TaskScore,
    confidence,
    evidence: evidence.trim(),
    followUp: typeof followUp === 'string' && followUp.trim() ? followUp.trim() : null,
    safetyFlags: safetyFlags.map((flag) => flag.trim()).filter(Boolean),
    modelId: modelId.trim(),
  }
}

export async function requestSemanticReview(
  request: SemanticReviewRequest,
  signal?: AbortSignal,
) {
  const endpoint = import.meta.env.VITE_LLM_ENDPOINT?.trim()
  if (!endpoint) throw new Error('未配置机构语义复核服务')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractVersion: SEMANTIC_REVIEW_CONTRACT_VERSION,
      ...request,
    }),
    signal,
  })
  if (!response.ok) throw new Error(`语义复核服务返回 ${response.status}`)
  return validateSemanticReviewResponse(await response.json())
}

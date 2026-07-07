// src/domain/shared/ai-provider.ts
// El dominio define QUÉ necesita de un proveedor de IA, nunca CÓMO (eso es infraestructura).
// Así, cambiar de Claude a OpenAI para un agente concreto es sustituir un adapter,
// no reescribir casos de uso.

export type RiskLevel = 'Alto' | 'Medio' | 'Bajo';

export interface ScoringAttributeInput {
  id: string;
  name: string;
  maxScore: number;
}
export interface ScoringAttributeResult {
  attributeId: string;
  score: number;
  rationale: string;
}

export interface RiskFactorInput {
  id: string;
  name: string;
}
export interface RiskFactorResult {
  factorId: string;
  level: RiskLevel;
  impact: RiskLevel;
}

export interface EconomicConceptInput {
  id: string;
  name: string;
  nature: 'cost' | 'result';
}
export interface EconomicConceptResult {
  conceptId: string;
  estimatedAmount: number | null;
}

export interface AIProvider {
  /** Agente 1 — Extracción: lee un documento y devuelve datos estructurados. */
  extractProposalData(fileBuffer: Buffer, mediaType: string): Promise<Record<string, unknown>>;

  /** Agente 2 — Evaluation: puntúa cada atributo del catálogo de scoring. */
  scoreAttributes(
    extractedData: Record<string, unknown>,
    attributes: ScoringAttributeInput[],
  ): Promise<ScoringAttributeResult[]>;

  /** Agente 3 — Risk: evalúa nivel/impacto de cada factor de riesgo del catálogo. */
  evaluateRiskFactors(
    extractedData: Record<string, unknown>,
    factors: RiskFactorInput[],
  ): Promise<RiskFactorResult[]>;

  /** Agente 5 — ROI/Financials: estima el importe de cada concepto económico del catálogo. */
  extractFinancialLines(
    extractedData: Record<string, unknown>,
    concepts: EconomicConceptInput[],
  ): Promise<EconomicConceptResult[]>;
}

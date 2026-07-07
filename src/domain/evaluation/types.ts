// src/domain/evaluation/types.ts

export interface ScoringAttributeCatalogItem {
  id: string;
  blockName: string;
  name: string;
  maxScore: number;
}

export interface RiskFactorCatalogItem {
  id: string;
  blockName: string;
  name: string;
}

export interface RiskMatrixRule {
  level: string;
  impact: string;
  score: number;
}

export interface EconomicConceptCatalogItem {
  id: string;
  name: string;
  nature: 'cost' | 'result';
}

export interface EvaluationCatalog {
  scoringAttributes: ScoringAttributeCatalogItem[];
  riskFactors: RiskFactorCatalogItem[];
  riskMatrixRules: RiskMatrixRule[];
  economicConcepts: EconomicConceptCatalogItem[];
}

export interface EvaluationOutcome {
  totalScore: number;
  overallRiskLevel: string;
  recommendation: string;
  scores: { attributeId: string; scoreValue: number; rationale: string }[];
  risks: { factorId: string; level: string; impact: string; computedScore: number }[];
  financials: { conceptId: string; estimatedAmount: number | null }[];
}

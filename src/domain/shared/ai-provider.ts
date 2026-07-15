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

export interface ActivationCatalogItemInput {
  id: string;
  area: string;
  name: string;
}
export interface ChannelInput {
  id: string;
  name: string;
}
export interface ActivationSuggestionResult {
  activationCatalogItemId: string;
  channelId: string | null;
  objective: string | null;
  description: string | null;
  priority: 'Alta' | 'Media' | 'Baja';
}

export interface WebEnrichmentInput {
  requesterName: string | null;
  website: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialYoutube: string | null;
  brandName: string | null;
}

export interface BrandStrategyInput {
  brandName: string;
  positioning: string | null;
  idealCollaborations: string[] | null;
  avoidCollaborations: string[] | null;
  strategicPriorities: string[] | null;
  evaluationBias: string | null;
  decisionStyle: string | null;
  /** Desglose real de propuestas ya evaluadas para esta marca, agrupado por tipo de
   *  colaboración — puede estar vacío si todavía no hay histórico suficiente. */
  historicalBreakdown: { collaborationType: string; count: number; avgScore: number }[];
}

export interface AIProvider {
  /** Agente 1 — Extracción: lee uno o varios archivos (ej. un dossier convertido a varias
   *  imágenes, una por página) y devuelve datos estructurados combinando todos. */
  extractProposalData(files: { buffer: Buffer; mediaType: string }[]): Promise<Record<string, unknown>>;

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

  /** Agente 4 — Activación: sugiere qué acciones del catálogo cerrado encajan con esta
   *  colaboración concreta. Nunca inventa una acción fuera de catálogo, y puede (y debe)
   *  sugerir menos acciones que el catálogo completo si no todas aplican. */
  suggestActivations(
    extractedData: Record<string, unknown>,
    catalogItems: ActivationCatalogItemInput[],
    channels: ChannelInput[],
  ): Promise<ActivationSuggestionResult[]>;

  /** Botón explícito "Enriquecer con búsqueda web" — nunca automático, por el coste y el
   *  tiempo de cada búsqueda. Devuelve texto libre (no JSON estructurado) para que la
   *  persona lo revise y lo edite antes de guardarlo — igual de "no inventes" que el
   *  resto: si no encuentra nada fiable, debe decirlo, no rellenar con suposiciones. */
  enrichWithWebSearch(input: WebEnrichmentInput): Promise<string>;

  /** Botón explícito "Generar recomendación estratégica" — combina el ADN de marca con el
   *  histórico real de propuestas evaluadas (y búsqueda web si el proveedor la soporta) para
   *  sugerir qué tipo de patrocinios/colaboraciones tienen sentido para esta marca. Nunca
   *  inventa tipos de colaboración fuera de lo razonable a partir de ideal_collaborations. */
  recommendForBrand(input: BrandStrategyInput): Promise<string>;

  /** Agente 5 — ROI/Financials: estima el importe de cada concepto económico del catálogo. */
  extractFinancialLines(
    extractedData: Record<string, unknown>,
    concepts: EconomicConceptInput[],
  ): Promise<EconomicConceptResult[]>;
}

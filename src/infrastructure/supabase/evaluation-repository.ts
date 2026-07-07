// src/infrastructure/supabase/evaluation-repository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import {
  EvaluationCatalogRepository,
  EvaluationResultRepository,
} from '../../domain/evaluation/repositories';
import { EvaluationCatalog, EvaluationOutcome } from '../../domain/evaluation/types';
import { OrganizationId, ProposalId } from '../../domain/shared/ids';

export class SupabaseEvaluationCatalogRepository implements EvaluationCatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getCatalog(organizationId: OrganizationId): Promise<EvaluationCatalog> {
    const [attrResult, factorResult, ruleResult, conceptResult] = await Promise.all([
      this.client
        .from('scoring_attributes')
        .select('id, name, max_score, scoring_blocks!inner(name, organization_id)')
        .eq('scoring_blocks.organization_id', organizationId),
      this.client
        .from('risk_factors')
        .select('id, name, risk_blocks!inner(name, organization_id)')
        .eq('risk_blocks.organization_id', organizationId),
      this.client.from('risk_matrix_rules').select('level, impact, score').eq('organization_id', organizationId),
      this.client.from('economic_concepts').select('id, name, nature').eq('organization_id', organizationId),
    ]);

    if (attrResult.error) throw attrResult.error;
    if (factorResult.error) throw factorResult.error;
    if (ruleResult.error) throw ruleResult.error;
    if (conceptResult.error) throw conceptResult.error;

    return {
      scoringAttributes: (attrResult.data ?? []).map((row: any) => ({
        id: row.id,
        blockName: row.scoring_blocks?.name ?? '',
        name: row.name,
        maxScore: Number(row.max_score),
      })),
      riskFactors: (factorResult.data ?? []).map((row: any) => ({
        id: row.id,
        blockName: row.risk_blocks?.name ?? '',
        name: row.name,
      })),
      riskMatrixRules: (ruleResult.data ?? []).map((row: any) => ({
        level: row.level,
        impact: row.impact,
        score: row.score,
      })),
      economicConcepts: (conceptResult.data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        nature: row.nature,
      })),
    };
  }
}

export class SupabaseEvaluationResultRepository implements EvaluationResultRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly tenantId: string,
    private readonly organizationId: string,
  ) {}

  async saveOutcome(proposalId: ProposalId, outcome: EvaluationOutcome, source: 'ai' | 'manual'): Promise<void> {
    const base = { tenant_id: this.tenantId, organization_id: this.organizationId, proposal_id: proposalId };

    if (outcome.scores.length) {
      const { error } = await this.client.from('proposal_scores').insert(
        outcome.scores.map((s) => ({
          ...base,
          scoring_attribute_id: s.attributeId,
          score_value: s.scoreValue,
          ai_rationale: s.rationale,
          source,
        })),
      );
      if (error) throw error;
    }

    if (outcome.risks.length) {
      const { error } = await this.client.from('proposal_risks').insert(
        outcome.risks.map((r) => ({
          ...base,
          risk_factor_id: r.factorId,
          level: r.level,
          impact: r.impact,
          computed_score: r.computedScore,
          source,
        })),
      );
      if (error) throw error;
    }

    if (outcome.financials.length) {
      const { error } = await this.client.from('proposal_financials').insert(
        outcome.financials.map((f) => ({
          ...base,
          economic_concept_id: f.conceptId,
          estimated_amount: f.estimatedAmount,
          source,
        })),
      );
      if (error) throw error;
    }

    const { error: updateError } = await this.client
      .from('proposals')
      .update({
        total_score: outcome.totalScore,
        overall_risk_level: outcome.overallRiskLevel,
        recommendation: outcome.recommendation,
        status: 'evaluated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (updateError) throw updateError;
  }
}

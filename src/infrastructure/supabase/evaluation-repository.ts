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
      this.client.from('economic_concepts').select('id, name, nature, block_type').eq('organization_id', organizationId),
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
        blockType: row.block_type ?? null,
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

    // "Historial de versiones": antes de sobrescribir, archiva el estado actual (si existe
    // alguno) como una nueva versión histórica. Si esta es la primera evaluación de la
    // propuesta, no hay nada que archivar todavía.
    const [{ data: existingScores }, { data: existingRisks }, { data: existingFinancials }, { data: currentProposal }] =
      await Promise.all([
        this.client.from('proposal_scores').select('scoring_attribute_id, score_value, source').eq('proposal_id', proposalId),
        this.client.from('proposal_risks').select('risk_factor_id, level, impact, computed_score, source').eq('proposal_id', proposalId),
        this.client.from('proposal_financials').select('economic_concept_id, estimated_amount, source').eq('proposal_id', proposalId),
        this.client.from('proposals').select('total_score, overall_risk_level, recommendation').eq('id', proposalId).maybeSingle(),
      ]);

    const hasExistingEvaluation = (existingScores?.length ?? 0) > 0 || (existingRisks?.length ?? 0) > 0 || (existingFinancials?.length ?? 0) > 0;

    if (hasExistingEvaluation) {
      const { count } = await this.client
        .from('proposal_evaluation_versions')
        .select('*', { count: 'exact', head: true })
        .eq('proposal_id', proposalId);
      const nextVersion = (count ?? 0) + 1;

      const { error: versionError } = await this.client.from('proposal_evaluation_versions').insert({
        tenant_id: this.tenantId,
        organization_id: this.organizationId,
        proposal_id: proposalId,
        version: nextVersion,
        total_score: currentProposal?.total_score ?? null,
        overall_risk_level: currentProposal?.overall_risk_level ?? null,
        recommendation: currentProposal?.recommendation ?? null,
      });
      if (versionError) throw versionError;

      if (existingScores?.length) {
        const { error } = await this.client
          .from('proposal_scores_history')
          .insert(existingScores.map((s) => ({ proposal_id: proposalId, version: nextVersion, ...s })));
        if (error) throw error;
      }
      if (existingRisks?.length) {
        const { error } = await this.client
          .from('proposal_risks_history')
          .insert(existingRisks.map((r) => ({ proposal_id: proposalId, version: nextVersion, ...r })));
        if (error) throw error;
      }
      if (existingFinancials?.length) {
        const { error } = await this.client
          .from('proposal_financials_history')
          .insert(existingFinancials.map((f) => ({ proposal_id: proposalId, version: nextVersion, ...f })));
        if (error) throw error;
      }
    }

    // A partir de aquí, exactamente el mismo comportamiento que ya existía: reemplaza por
    // completo el resultado "en vivo" — necesario para que reevaluar no acumule duplicados.
    const [delScores, delRisks, delFinancials] = await Promise.all([
      this.client.from('proposal_scores').delete().eq('proposal_id', proposalId),
      this.client.from('proposal_risks').delete().eq('proposal_id', proposalId),
      this.client.from('proposal_financials').delete().eq('proposal_id', proposalId),
    ]);
    if (delScores.error) throw delScores.error;
    if (delRisks.error) throw delRisks.error;
    if (delFinancials.error) throw delFinancials.error;

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

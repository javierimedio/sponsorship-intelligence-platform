-- 0017_evaluation_results_delete_policy.sql
-- Faltaba la política de DELETE en las tablas de resultado (0013 solo tenía select/insert).
-- Se necesita ahora porque saveOutcome() borra el resultado anterior antes de guardar el
-- nuevo, para que reevaluar una propuesta (edición) no acumule filas duplicadas.

create policy proposal_scores_delete on proposal_scores for delete
  using (tenant_id = current_tenant() and organization_id = current_org());

create policy proposal_risks_delete on proposal_risks for delete
  using (tenant_id = current_tenant() and organization_id = current_org());

create policy proposal_financials_delete on proposal_financials for delete
  using (tenant_id = current_tenant() and organization_id = current_org());

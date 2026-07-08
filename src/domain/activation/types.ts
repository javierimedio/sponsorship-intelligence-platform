// src/domain/activation/types.ts

export interface ActivationCatalogItem {
  id: string;
  area: string;
  name: string;
}

export interface ChannelItem {
  id: string;
  name: string;
}

export interface KpiDefinitionItem {
  id: string;
  name: string;
}

export interface ActivationActionInput {
  activationCatalogItemId: string;
  channelId: string | null;
  objective: string | null;
  description: string | null;
  priority: string | null;       // 'Alta' | 'Media' | 'Baja'
  expectedImpact: string | null; // 'Alto' | 'Medio' | 'Bajo'
  effort: string | null;         // 'Alto' | 'Medio' | 'Bajo'
  responsible: string | null;
  startDate: string | null;
  endDate: string | null;
  kpiDefinitionId: string | null;
  kpiTarget: string | null;
  isReusable: boolean | null;
  usefulLife: string | null;
}

export interface ActivationAction extends ActivationActionInput {
  id: string;
  status: string; // 'pending' | 'in_progress' | 'done' | 'cancelled'
  kpiResult: string | null;
  source: 'ai' | 'manual';
  activationCatalogItemArea?: string;
  activationCatalogItemName?: string;
  channelName?: string | null;
  kpiDefinitionName?: string | null;
}

export interface ActivationFollowUpInput {
  status?: string;
  kpiResult?: string | null;
}

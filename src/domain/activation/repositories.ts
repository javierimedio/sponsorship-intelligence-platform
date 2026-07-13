// src/domain/activation/repositories.ts

import {
  ActivationAction,
  ActivationActionInput,
  ActivationCatalogItem,
  ActivationFollowUpInput,
  ChannelItem,
  KpiDefinitionItem,
} from './types';
import { OrganizationId, ProposalId } from '../shared/ids';

export interface ActivationCatalogRepository {
  getCatalogItems(organizationId: OrganizationId): Promise<ActivationCatalogItem[]>;
  getChannels(organizationId: OrganizationId): Promise<ChannelItem[]>;
  getKpiDefinitions(organizationId: OrganizationId): Promise<KpiDefinitionItem[]>;
}

export interface ActivationResultRepository {
  addAction(proposalId: ProposalId, input: ActivationActionInput, source: 'ai' | 'manual'): Promise<ActivationAction>;
  listActions(proposalId: ProposalId): Promise<ActivationAction[]>;
  updateAction(actionId: string, input: Partial<ActivationActionInput>): Promise<void>;
  updateFollowUp(actionId: string, input: ActivationFollowUpInput): Promise<void>;
  deleteAction(actionId: string): Promise<void>;
}

// src/domain/shared/ids.ts
// Tipos nominales para no confundir un TenantId con un OrganizationId aunque ambos sean string
// en tiempo de ejecución. Coste cero en runtime, protección real en compilación.

export type TenantId = string & { readonly __brand: 'TenantId' };
export type OrganizationId = string & { readonly __brand: 'OrganizationId' };
export type BrandId = string & { readonly __brand: 'BrandId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type ProposalId = string & { readonly __brand: 'ProposalId' };
export type DocumentId = string & { readonly __brand: 'DocumentId' };

export const asTenantId = (id: string): TenantId => id as TenantId;
export const asOrganizationId = (id: string): OrganizationId => id as OrganizationId;
export const asBrandId = (id: string): BrandId => id as BrandId;
export const asUserId = (id: string): UserId => id as UserId;
export const asProposalId = (id: string): ProposalId => id as ProposalId;
export const asDocumentId = (id: string): DocumentId => id as DocumentId;

// src/application/use-cases/tenancy/create-brand.ts
// Plantilla del patrón que seguirán TODOS los casos de uso del proyecto:
// - una sola responsabilidad
// - recibe dependencias por interfaz (inyección), nunca importa Supabase
// - valida la regla de negocio que le corresponde a ESTE agregado, nada más
// - no llama a otros casos de uso directamente (la orquestación futura será vía eventos)

import { randomUUID } from 'crypto';
import { Brand } from '../../../domain/tenancy/brand';
import { BrandRepository, OrganizationRepository } from '../../../domain/tenancy/repositories';
import { asBrandId, OrganizationId } from '../../../domain/shared/ids';

export interface CreateBrandInput {
  organizationId: OrganizationId;
  name: string;
}

export class CreateBrandUseCase {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(input: CreateBrandInput): Promise<Brand> {
    const organization = await this.organizationRepository.findById(input.organizationId);
    if (!organization) {
      throw new Error(`No existe la organización ${input.organizationId}.`);
    }

    const brand = Brand.create({
      id: asBrandId(randomUUID()),
      organizationId: input.organizationId,
      name: input.name,
    });

    await this.brandRepository.save(brand);
    return brand;
  }
}

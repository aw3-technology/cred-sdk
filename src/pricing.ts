/**
 * Pricing API Module
 *
 * Manage pricing tiers for credit packages.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  PricingTierResponse,
  PricingTiersResponse,
  ListPricingTiersParams,
  CreatePricingTierParams,
  UpdatePricingTierParams,
  DeletePricingTierParams,
  DeletePricingTierResponse,
} from "./types";

export class PricingAPI extends BaseResource {
  /**
   * List the project's active pricing tiers, cheapest first. `price` is a
   * two-decimal string. Pass `credit_type_id` to narrow to tiers sold for that
   * credit type (including tiers that apply to every type).
   *
   * @example
   * ```typescript
   * const { data } = await cred.pricing.list({ credit_type_id: 'ct_123' });
   * data?.pricing_tiers.forEach(tier => {
   *   console.log(`${tier.name}: ${tier.credits} credits for $${tier.price}`);
   * });
   * ```
   */
  async list(
    params: ListPricingTiersParams = {},
  ): Promise<APIResponse<PricingTiersResponse>> {
    return this.query("/credits-api/pricing-tiers", { ...params });
  }

  /**
   * Create a new pricing tier
   *
   * @example
   * ```typescript
   * const tier = await cred.pricing.create({
   *   name: 'Starter Pack',
   *   description: 'Perfect for getting started',
   *   price: 9.99,
   *   credits: 100,
   *   currency: 'USD'
   * });
   * ```
   */
  async create(
    params: CreatePricingTierParams,
  ): Promise<APIResponse<PricingTierResponse>> {
    return this.post("/credits-api/pricing-tiers", { ...params });
  }

  /**
   * Update an existing pricing tier. Only the provided fields are changed.
   *
   * @example
   * ```typescript
   * await cred.pricing.update('tier_123', {
   *   price: 19.99,
   *   credit_type_ids: ['ct_abc'], // restrict; pass [] to apply to all
   * });
   * ```
   */
  async update(
    tierId: string,
    params: UpdatePricingTierParams,
  ): Promise<APIResponse<PricingTierResponse>> {
    return this.patch("/credits-api/pricing-tiers", { ...params, id: tierId });
  }

  /**
   * Delete a pricing tier. A tier that auto top-up rules buy is protected:
   * the call fails with `409 TIER_IN_USE` (`error.details.auto_topup_rules` is
   * the rule count) unless you pass `force: true`, which deletes those rules
   * and the tier together in one transaction. To stop selling a tier but keep
   * its history, `update(id, { is_active: false })` instead.
   *
   * @example
   * ```typescript
   * const res = await cred.pricing.delete('tier_123');
   * if (res.error?.code === 'TIER_IN_USE') {
   *   // Confirm with the operator, then:
   *   await cred.pricing.delete('tier_123', { force: true });
   * }
   * ```
   */
  async delete(
    tierId: string,
    params: DeletePricingTierParams = {},
  ): Promise<APIResponse<DeletePricingTierResponse>> {
    return this.del("/credits-api/pricing-tiers", {
      id: tierId,
      ...(params.force === true ? { force: true } : {}),
    });
  }
}

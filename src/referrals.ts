/**
 * Referrals API Module
 *
 * Configure a referral program and issue referrer/referee bonuses when a
 * referral code is applied.
 */

import { BaseResource } from "./base";
import type {
  APIResponse,
  SaveReferralSettingsParams,
  GetReferralsParams,
  ReferralSettingsResponse,
  SaveReferralSettingsResponse,
  ReferralsListResponse,
  ApplyReferralParams,
  ApplyReferralResponse,
  CompleteReferralParams,
  CompleteReferralResponse,
  GenerateReferralCodeResponse,
} from "./types";

export class ReferralsAPI extends BaseResource {
  /**
   * Get the project's referral program settings.
   *
   * @example
   * ```typescript
   * const { data } = await cred.referrals.getSettings();
   * console.log(data?.settings?.is_active);
   * ```
   */
  async getSettings(
    params: { credit_type_id?: string } = {},
  ): Promise<APIResponse<ReferralSettingsResponse>> {
    return this.query("/credits-api/referral-settings", { ...params });
  }

  /**
   * Create or update the referral program settings.
   *
   * @example
   * ```typescript
   * await cred.referrals.saveSettings({
   *   is_active: true,
   *   referrer_credits: 100,
   *   referee_credits: 50,
   *   credit_type_id: 'ct_123',
   * });
   * ```
   */
  async saveSettings(
    params: SaveReferralSettingsParams,
  ): Promise<APIResponse<SaveReferralSettingsResponse>> {
    return this.post("/credits-api/referral-settings", { ...params });
  }

  /**
   * List referrals, optionally filtered by status or referrer.
   *
   * @example
   * ```typescript
   * const { data } = await cred.referrals.list({ status: 'completed' });
   * ```
   */
  async list(
    params: GetReferralsParams = {},
  ): Promise<APIResponse<ReferralsListResponse>> {
    return this.query("/credits-api/referrals", { ...params });
  }

  /**
   * Apply a referral code for a user, issuing the configured bonuses.
   *
   * @example
   * ```typescript
   * await cred.referrals.apply({ user_id: 'user_123', referral_code: 'ABC12345' });
   * ```
   */
  async apply(params: ApplyReferralParams): Promise<APIResponse<ApplyReferralResponse>> {
    return this.post("/credits-api/referrals/apply", { ...params });
  }

  /**
   * Pay the referrer of a referral applied with `defer_referrer_credits`.
   * Safe to retry: the payout is keyed per referral.
   *
   * @example
   * ```typescript
   * await cred.referrals.complete({ user_id: 'user_123', credit_type_id: 'ct_123' });
   * ```
   */
  async complete(params: CompleteReferralParams): Promise<APIResponse<CompleteReferralResponse>> {
    return this.post("/credits-api/referrals/complete", { ...params });
  }

  /**
   * Generate (or fetch the existing) referral code for a user.
   *
   * @example
   * ```typescript
   * const { data } = await cred.referrals.generateCode({ user_id: 'user_123' });
   * console.log(data?.referral_code);
   * ```
   */
  async generateCode(params: {
    user_id: string;
  }): Promise<APIResponse<GenerateReferralCodeResponse>> {
    return this.post("/credits-api/referrals/generate-code", { ...params });
  }
}

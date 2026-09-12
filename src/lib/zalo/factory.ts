import { env } from "@/env";
import type { ZaloClient } from "./client";
import { MockZaloClient } from "./client-mock";
import { RealZaloClient } from "./client-real";

let cached: ZaloClient | undefined;

export function getZaloClient(): ZaloClient {
  if (!cached) {
    cached =
      env.ZALO_TRANSPORT === "live"
        ? new RealZaloClient()
        : new MockZaloClient();
  }
  return cached;
}

/**
 * The live transport even when `ZALO_TRANSPORT=mock`, so the /settings/zalo
 * send tester can push real OA messages using the token in `zalo_oa_token`.
 * Only reachable from the non-production tester action.
 */
export function getRealZaloClient(): ZaloClient {
  return new RealZaloClient();
}

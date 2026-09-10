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

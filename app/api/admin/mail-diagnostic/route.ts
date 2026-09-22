import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/access";
import { authenticate, apiError } from "@/lib/http";
import {
  getSmtpRuntimeConfig,
  verifySmtpConnection,
} from "@/lib/mail/smtp";

/**
 * Temporary ADMIN-only SMTP diagnostic.
 * Never returns SMTP_PASS or full credentials.
 * Remove once mail delivery is validated in production.
 */
export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    requireAdminApi(user);

    const config = getSmtpRuntimeConfig();
    const verify = config.configured
      ? await verifySmtpConnection()
      : { ok: false as const, detail: "email_not_configured" };

    return NextResponse.json({
      configured: config.configured,
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from,
      userSet: config.userSet,
      passSet: config.passSet,
      appUrl: config.appUrl,
      verify,
    });
  } catch (error) {
    return apiError(error);
  }
}

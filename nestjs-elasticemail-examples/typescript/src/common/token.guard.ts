import { CanActivate, ExecutionContext, Injectable, RawBodyRequest, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { safeEqual, signingSecret, verifySignature, webhookSecret } from "./security";

/**
 * Checks the shared secret carried in the URL (?token=ELASTICEMAIL_WEBHOOK_TOKEN) with a
 * constant-time compare. Used for inbound email (never signed) and for unsigned webhooks.
 */
@Injectable()
export class TokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!safeEqual(req.query.token, webhookSecret())) {
      throw new UnauthorizedException("Invalid token");
    }
    return true;
  }
}

/**
 * Webhook event routes. When ELASTICEMAIL_WEBHOOK_SECRET is set, every request must carry a valid
 * HMAC-SHA256 signature (X-ElasticEmail-Timestamp + X-ElasticEmail-Signature) over the raw body,
 * which main.ts keeps with NestFactory.create(..., { rawBody: true }). Without a secret it falls
 * back to the ?token= check, so unsigned webhooks keep working.
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly tokenGuard = new TokenGuard();

  canActivate(context: ExecutionContext): boolean {
    const secret = signingSecret();
    if (!secret) return this.tokenGuard.canActivate(context);

    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const ok = verifySignature(
      secret,
      req.method,
      req.originalUrl, // path + query exactly as received, still URL-encoded
      req.rawBody ?? "",
      req.headers["x-elasticemail-timestamp"],
      req.headers["x-elasticemail-signature"],
    );
    if (!ok) {
      throw new UnauthorizedException("Invalid signature");
    }
    return true;
  }
}

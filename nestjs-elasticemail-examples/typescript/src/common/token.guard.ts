import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { safeEqual, webhookSecret } from "./security";

/**
 * Elastic Email does not sign webhook or inbound requests, so the URL carries a shared
 * secret (?token=ELASTICEMAIL_WEBHOOK_TOKEN). This guard checks it with a constant-time compare.
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

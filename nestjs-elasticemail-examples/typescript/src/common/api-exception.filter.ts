import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Response } from "express";

/**
 * Turns every error into `{ "error": "<message>" }`.
 * - Nest HttpExceptions (400 validation, 401 token, 404 route) keep their status and message.
 * - Elastic Email API errors (axios) keep the API status and its `{ "Error": "..." }` message.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === "string" ? body : (body as any).message ?? exception.message;
      res.status(exception.getStatus()).json({ error: Array.isArray(message) ? message.join(", ") : message });
      return;
    }

    res.status(exception?.response?.status ?? 500).json({
      error: exception?.response?.data?.Error ?? exception?.message ?? "Unknown error",
    });
  }
}

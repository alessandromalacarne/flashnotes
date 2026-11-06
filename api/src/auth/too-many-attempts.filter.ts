import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

export class TooManyAttemptsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      'Too many sign-in attempts. Try again later.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Catch(TooManyAttemptsException)
export class TooManyAttemptsFilter implements ExceptionFilter<TooManyAttemptsException> {
  catch(exception: TooManyAttemptsException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: exception.message,
    });
  }
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TooManyAttemptsFilter } from './auth/too-many-attempts.filter.js';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new TooManyAttemptsFilter());
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ContractViolationFilter } from './common/filters/contract-violation.filter';
import { CentralLogger } from './logging/central-logger.service';

async function bootstrap() {
  const logger = new CentralLogger();
  const app = await NestFactory.create(AppModule, { logger });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ContractViolationFilter());

  const port = process.env.PORT || 3397;
  await app.listen(port);
  logger.log(`docs-rag-microservice listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  const logger = new CentralLogger();
  logger.error('Failed to bootstrap application', err instanceof Error ? err.stack : undefined, { error: err });
  process.exit(1);
});

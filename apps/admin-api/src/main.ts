import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  const webUrl = config.get<string>('app.adminWebUrl') ?? '';
  app.enableCors({
    origin: webUrl ? [webUrl, 'http://localhost:5174'] : true,
    credentials: true,
  });

  const port = config.get<number>('app.port') ?? 3002;
  await app.listen(port, '0.0.0.0');
  console.log(`Veepie Forms Admin API rodando na porta ${port}/api/v1`);
}
bootstrap();

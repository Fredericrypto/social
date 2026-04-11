import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  // Permitir ngrok tunnel
  app.use((req: any, res: any, next: any) => {
    res.setHeader("ngrok-skip-browser-warning", "true");
    next();
  });

  app.enableCors({
    origin: true, // aceita qualquer origem em desenvolvimento
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Minha Rede API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); // escuta em todas as interfaces
  console.log(`🚀 Backend rodando em http://localhost:${port}`);
  console.log(`📖 Docs em http://localhost:${port}/api/docs`);
}
bootstrap();

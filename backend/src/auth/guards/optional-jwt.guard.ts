import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * OptionalJwtGuard — permite requisições sem token (públicas)
 * mas popula req.user quando um token válido é enviado.
 * Usado em endpoints públicos que retornam dados enriquecidos para usuários logados.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  // Nunca lança erro — deixa a requisição passar mesmo sem token
  handleRequest(err: any, user: any) {
    return user || null;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

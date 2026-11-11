import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class CameraStreamAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.query.token;

    if (!request.headers.authorization && typeof token === 'string') {
      request.headers.authorization = `Bearer ${token}`;
    }

    return request;
  }
}

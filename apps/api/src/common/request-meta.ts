import { Request } from 'express';
import { RequestMeta } from './auth-user';

export function requestMeta(req: Request): RequestMeta {
  const agent = req.headers['user-agent'];
  return {
    ip: req.ip,
    userAgent: Array.isArray(agent) ? agent[0] : agent,
  };
}

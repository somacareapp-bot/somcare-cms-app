import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
  fullName: string;
  profilePhoto?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

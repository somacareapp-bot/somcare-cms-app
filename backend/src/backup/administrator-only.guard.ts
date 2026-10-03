import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';

/** Allows only users who hold the 'administrator' role (checked in the database, not from the token). */
@Injectable()
export class AdministratorOnlyGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const id = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    if (!id) throw new ForbiddenException('Only an administrator can reset the app');

    const user: any = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id } as any, relations: ['roles'] } as any);

    const names: string[] = (user?.roles ?? []).map((r: any) => (typeof r === 'string' ? r : r?.name));
    if (!names.includes('administrator')) {
      throw new ForbiddenException('Only an administrator can reset the app');
    }
    return true;
  }
}

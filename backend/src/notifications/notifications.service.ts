import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
  ) {}

  // Call this from anywhere in the app (prescriptions, appointments, etc.)
  // to fire a notification + push it live over the socket.
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.repo.create(await this.enrichActor(dto));
    const saved = await this.repo.save(notification);
    this.gateway.pushToUser(dto.recipientId, saved);
    return saved;
  }

  // Show people by their real name (first + last) with their profile photo, no matter which
  // module sent the notification. Senders that pass a login name (e.g. "medical.director")
  // are matched to their user record. Also drops the sender's name from the start of the
  // message, because the bell already prints it in bold in front of the message.
  private async enrichActor(dto: CreateNotificationDto): Promise<CreateNotificationDto> {
    const original = (dto.actorName ?? '').trim();
    let name = original;
    let avatar = dto.actorAvatarUrl;
    let actor: { id: string; name: string; position: string | null; department: string | null } | null = null;
    try {
      if (original) {
        const users = this.repo.manager.getRepository(User);
        // 1) by login name (expenses etc.)  2) by full name when it is unique (leave etc.)
        let user = await users
          .createQueryBuilder('u')
          .leftJoinAndSelect('u.department', 'd')
          .where('LOWER(u.username) = LOWER(:n)', { n: original })
          .getOne();
        if (!user) {
          const byName = await users
            .createQueryBuilder('u')
            .leftJoinAndSelect('u.department', 'd')
            .where("LOWER(CONCAT(u.firstName, ' ', u.lastName)) = LOWER(:n)", { n: original })
            .getMany();
          if (byName.length === 1) user = byName[0];
        }
        if (user) {
          const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
          if (full) name = full;
          if (!avatar && user.profilePhoto) avatar = user.profilePhoto;
          actor = {
            id: user.id,
            name: full || original,
            position: user.position || null,
            department: (user.department as any)?.name ?? null,
          };
        }
      }
    } catch (e) {
      this.logger.warn(`Could not resolve notification sender "${original}": ${(e as Error).message}`);
    }

    let message = dto.message;
    for (const prefix of Array.from(new Set([original, name].filter(Boolean)))) {
      if (message.length > prefix.length + 1 && message.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) {
        message = message.slice(prefix.length + 1);
        break;
      }
    }
    // meta.actor powers the profile card that opens when you click a photo in the bell.
    const meta = actor ? { ...(dto.meta ?? {}), actor } : dto.meta;
    return { ...dto, actorName: name || dto.actorName, actorAvatarUrl: avatar, message, meta };
  }

  // Cursor-free simple pagination — good enough for a dropdown feed.
  async findForUser(
    userId: string,
    { limit = 20, offset = 0, unreadOnly = false }: { limit?: number; offset?: number; unreadOnly?: boolean },
  ) {
    const where: any = { recipientId: userId };
    if (unreadOnly) where.read = false;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const unreadCount = await this.repo.count({
      where: { recipientId: userId, read: false },
    });

    return { items, total, unreadCount };
  }

  async markRead(userId: string, id: string) {
    await this.repo.update({ id, recipientId: userId }, { read: true });
    return this.getUnreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.repo.update({ recipientId: userId, read: false }, { read: true });
    return { unreadCount: 0 };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.repo.count({
      where: { recipientId: userId, read: false },
    });
    return { unreadCount };
  }
}

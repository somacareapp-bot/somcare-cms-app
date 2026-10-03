import { NotificationType } from '../notification.entity';

export class CreateNotificationDto {
  recipientId: string;
  actorName?: string;
  actorAvatarUrl?: string;
  type: NotificationType;
  message: string;
  meta?: Record<string, any>;
  link?: string;
}

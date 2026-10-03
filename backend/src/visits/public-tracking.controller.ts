import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { VisitsService } from './visits.service';

// Public, unauthenticated - this is what the QR code on patient receipts
// links to. No JwtAuthGuard on purpose. Only returns minimal queue-stage
// info, gated by patientNumber matching (see VisitsService.findPublicStatus).
@Controller('public/track')
export class PublicTrackingController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  async track(@Query('aid') appointmentId?: string, @Query('pn') patientNumber?: string) {
    if (!appointmentId || !patientNumber) {
      throw new NotFoundException('Tracking info not found');
    }
    return this.visitsService.findPublicStatus(appointmentId, patientNumber);
  }
}

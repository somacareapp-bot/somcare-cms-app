import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FaqService } from './faq.service';
import { AskFaqDto } from './dto/ask-faq.dto';

@UseGuards(JwtAuthGuard)
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  listAll() {
    return this.faqService.listAll();
  }

  @Get('categories')
  listCategories() {
    return this.faqService.listCategories();
  }

  @Post('ask')
  ask(@Body() dto: AskFaqDto) {
    return this.faqService.ask(dto.question);
  }
}

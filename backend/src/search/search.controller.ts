import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

// No PermissionsGuard here on purpose: this aggregates read-only summary
// data (names, codes, dates — no financial or clinical detail) across
// several modules the user may only have partial permissions on, so it's
// gated just by being logged in, same pattern as the health check.
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') q: string) {
    return this.searchService.search(q);
  }
}

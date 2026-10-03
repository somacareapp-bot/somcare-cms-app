# Backend changes required for Diagnosis Codes

## 1. Visit entity — add `diagnosisCodes` column

File: `backend/src/visits/entities/visit.entity.ts`

Add this column after the existing `diagnosis` column:

```typescript
@Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
diagnosisCodes: {
  code: string;
  description: string;
  type: 'primary' | 'secondary' | 'complication' | 'co-morbidity';
}[];
```

## 2. Update consultation DTO

File: `backend/src/visits/dto/update-consultation.dto.ts`

Add the new field:

```typescript
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosisCodeDto {
  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsIn(['primary', 'secondary', 'complication', 'co-morbidity'])
  type: string;
}

export class UpdateConsultationDto {
  // ... existing fields ...

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisCodeDto)
  diagnosisCodes?: DiagnosisCodeDto[];
}
```

## 3. Generate and run migration

```bash
cd backend
npx typeorm migration:generate src/migrations/AddDiagnosisCodesToVisit
npx typeorm migration:run
```

## 4. No API route changes needed

The existing `PATCH /visits/:id/consultation` endpoint already receives the
full body from `updateConsultation()` — just make sure the service passes
`diagnosisCodes` through to the entity save. Example in `visits.service.ts`:

```typescript
async updateConsultation(id: string, dto: UpdateConsultationDto) {
  return this.visitsRepository.update(id, {
    chiefComplaint: dto.chiefComplaint,
    historyOfPresentIllness: dto.historyOfPresentIllness,
    examinationFindings: dto.examinationFindings,
    diagnosis: dto.diagnosis,
    diagnosisCodes: dto.diagnosisCodes ?? [],   // ← add this
  });
}
```

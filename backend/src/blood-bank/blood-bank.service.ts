import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BloodInventoryMovement, BloodMovementType } from './entities/blood-movement.entity';
import { BloodDonor } from './entities/blood-donor.entity';
import { BloodGroup } from '../patients/entities/patient.entity';
import { AddUnitsDto } from './dto/add-units.dto';
import { IssueUnitsDto } from './dto/issue-units.dto';
import { CreateDonationDto } from './dto/create-donation.dto';

const ALL_BLOOD_GROUPS = [
  BloodGroup.A_POS, BloodGroup.A_NEG, BloodGroup.B_POS, BloodGroup.B_NEG,
  BloodGroup.AB_POS, BloodGroup.AB_NEG, BloodGroup.O_POS, BloodGroup.O_NEG,
];

// Frontend's Donor type expects { id, name, bloodType, units, date, contact } —
// the entity stores bloodGroup / donationDate, so map field names on the way out.
function toDonorDto(donor: BloodDonor) {
  return {
    id: donor.id,
    name: donor.name,
    bloodType: donor.bloodGroup,
    units: donor.units,
    date: donor.donationDate,
    contact: donor.contact,
  };
}

@Injectable()
export class BloodBankService {
  constructor(
    @InjectRepository(BloodInventoryMovement)
    private readonly movementsRepo: Repository<BloodInventoryMovement>,
    @InjectRepository(BloodDonor)
    private readonly donorsRepo: Repository<BloodDonor>,
  ) {}

  async getInventory() {
    const rows = await this.movementsRepo
      .createQueryBuilder('m')
      .select('m.bloodGroup', 'bloodType')
      .addSelect('SUM(CASE WHEN m.type = :issue THEN -m.units ELSE m.units END)', 'units')
      .setParameter('issue', BloodMovementType.ISSUE)
      .groupBy('m.bloodGroup')
      .getRawMany();

    const totals = new Map<string, number>(rows.map((r) => [r.bloodType, parseInt(r.units, 10)]));
    return ALL_BLOOD_GROUPS.map((bt) => ({ bloodType: bt, units: totals.get(bt) ?? 0 }));
  }

  private async getBalance(bloodType: BloodGroup): Promise<number> {
    const inventory = await this.getInventory();
    return inventory.find((i) => i.bloodType === bloodType)?.units ?? 0;
  }

  async addUnits(dto: AddUnitsDto, userId?: string) {
    const movement = this.movementsRepo.create({
      bloodGroup: dto.bloodType,
      type: BloodMovementType.ADD,
      units: dto.units,
      note: dto.note,
      createdBy: userId,
    } as any);
    await this.movementsRepo.save(movement);
    return this.getInventory();
  }

  async issueUnits(dto: IssueUnitsDto, userId?: string) {
    const current = await this.getBalance(dto.bloodType);
    if (current < dto.units) {
      throw new BadRequestException(
        `Only ${current} units of ${dto.bloodType} available, cannot issue ${dto.units}`,
      );
    }
    const movement = this.movementsRepo.create({
      bloodGroup: dto.bloodType,
      type: BloodMovementType.ISSUE,
      units: dto.units,
      note: dto.note,
      createdBy: userId,
    } as any);
    await this.movementsRepo.save(movement);
    return this.getInventory();
  }

  async getDonors() {
    const donors = await this.donorsRepo.find({ order: { donationDate: 'DESC' } });
    return donors.map(toDonorDto);
  }

  async recordDonation(dto: CreateDonationDto, userId?: string) {
    // `as any` makes TypeORM's overload resolution pick the array-returning
    // create() signature, so cast the result back to a single entity.
    const donor = this.donorsRepo.create({
      name: dto.name,
      bloodGroup: dto.bloodType,
      units: dto.units,
      contact: dto.contact,
      donationDate: dto.donationDate ? new Date(dto.donationDate) : new Date(),
      createdBy: userId,
    } as any) as unknown as BloodDonor;
    await this.donorsRepo.save(donor);

    const movement = this.movementsRepo.create({
      bloodGroup: dto.bloodType,
      type: BloodMovementType.DONATION,
      units: dto.units,
      note: `Donation from ${dto.name}`,
      createdBy: userId,
    } as any);
    await this.movementsRepo.save(movement);

    return toDonorDto(donor);
  }
}

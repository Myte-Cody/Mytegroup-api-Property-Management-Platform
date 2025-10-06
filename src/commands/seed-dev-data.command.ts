import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Command, CommandRunner, Option } from 'nest-commander';
import { UnitAvailabilityStatus, UnitType } from '../common/enums/unit.enum';
import { UserType } from '../common/enums/user-type.enum';
import { Contractor } from '../features/contractors/schema/contractor.schema';
import { Landlord } from '../features/landlords/schema/landlord.schema';
import { Property } from '../features/properties/schemas/property.schema';
import { Unit } from '../features/properties/schemas/unit.schema';
import { Tenant } from '../features/tenants/schema/tenant.schema';
import { User } from '../features/users/schemas/user.schema';

interface DevDataSeedOptions {
  clean?: boolean;
}

@Injectable()
@Command({
  name: 'seed:dev-data',
  description: 'Seed comprehensive development test data',
})
export class SeedDevDataCommand extends CommandRunner {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Landlord.name) private readonly landlordModel: Model<Landlord>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(Contractor.name) private readonly contractorModel: Model<Contractor>,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
    @InjectModel(Unit.name) private readonly unitModel: Model<Unit>,
  ) {
    super();
  }

  async run(passedParam: string[], options?: DevDataSeedOptions): Promise<void> {
    try {
      console.log('🌱 Starting dev data seeding...\n');

      const shouldClean = options?.clean || true; // Default to cleaning
      const verbose = true; // Always verbose

      if (shouldClean) {
        await this.cleanExistingData(verbose);
      }

      // Create 1 landlord
      const landlord = await this.createLandlord(verbose);

      // Create 1 user for the landlord
      await this.createUser(landlord, verbose);

      await this.printSummary();

      console.log('\n🎉 Minimal dev data seeding completed successfully!');
      console.log('\n📝 Login credentials:');
      console.log('   Email: landlord@example.com');
      console.log('   Password: password123');
    } catch (error) {
      console.error('❌ Dev data seeding failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exit(1);
    }
  }

  private async cleanExistingData(verbose: boolean): Promise<void> {
    if (verbose) console.log('🧹 Cleaning existing data...');

    await Promise.all([
      this.userModel.deleteMany({}),
      this.tenantModel.deleteMany({}),
      this.contractorModel.deleteMany({}),
      this.unitModel.deleteMany({}),
      this.propertyModel.deleteMany({}),
      this.landlordModel.deleteMany({}),
    ]);

    console.log('✅ Existing data cleaned');
  }

  private async createLandlord(verbose: boolean): Promise<any> {
    if (verbose) console.log('👔 Creating landlord...');

    const landlord = new this.landlordModel({
      name: 'Myte Estates',
    });

    const saved = await landlord.save();
    if (verbose) console.log(`  ✅ Created landlord: ${saved.name}`);

    return saved;
  }

  private async createUser(landlord: any, verbose: boolean): Promise<any> {
    if (verbose) console.log('👤 Creating landlord user...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = new this.userModel({
      username: 'landlord',
      firstName: 'John',
      lastName: 'Doe',
      email: 'landlord@example.com',
      password: hashedPassword,
      phone: '+1234567890',
      user_type: UserType.LANDLORD,
      organization_id: landlord._id,
      isPrimary: true,
    });

    const saved = await user.save();
    if (verbose) console.log(`  ✅ Created user: ${saved.email}`);

    return saved;
  }

  private async printSummary(): Promise<void> {
    console.log('\n📊 Seeding Summary:');
    console.log('├── Landlords: 1');
    console.log('└── Users: 1');
  }

  // Command options
  @Option({
    flags: '-c, --clean',
    description: 'Clean existing data before seeding (default: true)',
  })
  parseClean(): boolean {
    return true;
  }
}

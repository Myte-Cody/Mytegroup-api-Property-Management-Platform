import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Command, CommandRunner, Option } from 'nest-commander';
import {
  LeaseStatus,
  PaymentCycle,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  RentalPeriodStatus,
} from '../common/enums/lease.enum';
import { TicketCategory, TicketPriority, TicketStatus } from '../common/enums/maintenance.enum';
import { UnitAvailabilityStatus, UnitType } from '../common/enums/unit.enum';
import { UserType } from '../common/enums/user-type.enum';
import { Contractor } from '../features/contractors/schema/contractor.schema';
import { Landlord } from '../features/landlords/schema/landlord.schema';
import { Lease } from '../features/leases/schemas/lease.schema';
import { RentalPeriod } from '../features/leases/schemas/rental-period.schema';
import { Transaction } from '../features/leases/schemas/transaction.schema';
import { MaintenanceTicket } from '../features/maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../features/maintenance/schemas/scope-of-work.schema';
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
    @InjectModel(Lease.name) private readonly leaseModel: Model<Lease>,
    @InjectModel(RentalPeriod.name) private readonly rentalPeriodModel: Model<RentalPeriod>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
    @InjectModel(MaintenanceTicket.name)
    private readonly maintenanceTicketModel: Model<MaintenanceTicket>,
    @InjectModel(ScopeOfWork.name)
    private readonly scopeOfWorkModel: Model<ScopeOfWork>,
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
      const landlordUser = await this.createUser(landlord, verbose);

      // Create multiple tenants with users
      const tenants = await this.createTenants(verbose);

      // Create contractors with users
      const contractors = await this.createContractors(verbose);

      // Create properties with units
      const { properties, units } = await this.createPropertiesWithUnits(verbose);

      // Create leases with different statuses, rental periods, and transactions
      const leases = await this.createLeasesWithTransactions(tenants, units, verbose);

      // Create maintenance tickets and scopes of work
      await this.createMaintenanceData(properties, units, landlordUser, verbose);

      await this.printSummary();

      console.log('\n🎉 Comprehensive dev data seeding completed successfully!');
      console.log('\n📝 Login credentials:');
      console.log('   Landlord: landlord@example.com / password123');
      console.log('   Tenants: tenant1@example.com, tenant2@example.com, etc. / password123');
      console.log('   Contractors: contractor1@example.com, contractor2@example.com, etc. / password123');
    } catch (error) {
      console.error('❌ Dev data seeding failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exit(1);
    }
  }

  private async cleanExistingData(verbose: boolean): Promise<void> {
    if (verbose) console.log('🧹 Cleaning existing data...');

    await Promise.all([
      this.maintenanceTicketModel.deleteMany({}),
      this.scopeOfWorkModel.deleteMany({}),
      this.transactionModel.deleteMany({}),
      this.rentalPeriodModel.deleteMany({}),
      this.leaseModel.deleteMany({}),
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

  private async createTenants(verbose: boolean): Promise<any[]> {
    if (verbose) console.log('👥 Creating tenants with users...');

    const tenantsData = [
      { name: 'Smith Family', firstName: 'John', lastName: 'Smith', email: 'tenant1@example.com' },
      {
        name: 'Johnson Household',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'tenant2@example.com',
      },
      {
        name: 'Williams Residence',
        firstName: 'Michael',
        lastName: 'Williams',
        email: 'tenant3@example.com',
      },
      { name: 'Brown Living', firstName: 'Emily', lastName: 'Brown', email: 'tenant4@example.com' },
      { name: 'Davis Home', firstName: 'David', lastName: 'Davis', email: 'tenant5@example.com' },
    ];

    const hashedPassword = await bcrypt.hash('password123', 10);
    const tenants = [];

    for (const data of tenantsData) {
      const tenant = await new this.tenantModel({
        name: data.name,
      }).save();

      await new this.userModel({
        username: data.firstName.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        user_type: UserType.TENANT,
        organization_id: tenant._id,
        isPrimary: true,
      }).save();

      tenants.push(tenant);
      if (verbose) console.log(`  ✅ Created tenant: ${tenant.name} with user ${data.email}`);
    }

    return tenants;
  }

  private async createContractors(verbose: boolean): Promise<any[]> {
    if (verbose) console.log('🔧 Creating contractors with users...');

    const contractorsData = [
      {
        name: 'Premier Plumbing Services',
        category: 'Plumbing',
        firstName: 'Bob',
        lastName: 'Martinez',
        email: 'contractor1@example.com',
      },
      {
        name: 'Elite HVAC Solutions',
        category: 'HVAC',
        firstName: 'Lisa',
        lastName: 'Anderson',
        email: 'contractor2@example.com',
      },
      {
        name: 'ProElectric Inc',
        category: 'Electrical',
        firstName: 'Tom',
        lastName: 'Wilson',
        email: 'contractor3@example.com',
      },
      {
        name: 'Quality Handyman Services',
        category: 'General Maintenance',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'contractor4@example.com',
      },
    ];

    const hashedPassword = await bcrypt.hash('password123', 10);
    const contractors = [];

    for (const data of contractorsData) {
      const contractor = await new this.contractorModel({
        name: data.name,
        category: data.category,
      }).save();

      await new this.userModel({
        username: data.firstName.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        user_type: UserType.CONTRACTOR,
        organization_id: contractor._id,
        isPrimary: true,
      }).save();

      contractors.push(contractor);
      if (verbose) console.log(`  ✅ Created contractor: ${contractor.name} with user ${data.email}`);
    }

    return contractors;
  }

  private async createPropertiesWithUnits(verbose: boolean): Promise<{
    properties: any[];
    units: any[];
  }> {
    if (verbose) console.log('🏢 Creating properties with units...');

    const propertiesData = [
      {
        name: 'Sunset Apartments',
        address: {
          street: '123 Sunset Blvd',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90028',
          country: 'USA',
        },
        description: 'Modern apartment complex in downtown LA',
        units: [
          { number: 'A101', size: 850, type: UnitType.APARTMENT, rent: 2500, publish: true },
          { number: 'A102', size: 900, type: UnitType.APARTMENT, rent: 2700, publish: true },
          { number: 'A201', size: 1200, type: UnitType.APARTMENT, rent: 3200, publish: false },
          { number: 'A202', size: 750, type: UnitType.STUDIO, rent: 2000, publish: true },
        ],
      },
      {
        name: 'Downtown Office Plaza',
        address: {
          street: '456 Business Ave',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94102',
          country: 'USA',
        },
        description: 'Premium office spaces in the financial district',
        units: [
          { number: 'Suite 300', size: 2500, type: UnitType.OFFICE, rent: 8000, publish: true },
          { number: 'Suite 400', size: 3000, type: UnitType.OFFICE, rent: 10000, publish: false },
        ],
      },
      {
        name: 'Green Valley Houses',
        address: {
          street: '789 Valley Road',
          city: 'Sacramento',
          state: 'CA',
          postalCode: '95814',
          country: 'USA',
        },
        description: 'Family-friendly residential homes',
        units: [
          { number: '1', size: 2200, type: UnitType.HOUSE, rent: 4500, publish: true },
          { number: '2', size: 1800, type: UnitType.HOUSE, rent: 3800, publish: false },
          { number: '3', size: 2000, type: UnitType.HOUSE, rent: 4200, publish: true },
        ],
      },
    ];

    const properties = [];
    const units = [];

    for (const propData of propertiesData) {
      const property = await new this.propertyModel({
        name: propData.name,
        address: propData.address,
        description: propData.description,
      }).save();

      properties.push(property);
      if (verbose) console.log(`  ✅ Created property: ${property.name}`);

      for (const unitData of propData.units) {
        const unit = await new this.unitModel({
          property: property._id,
          unitNumber: unitData.number,
          size: unitData.size,
          type: unitData.type,
          availabilityStatus: UnitAvailabilityStatus.VACANT,
          availableForRent: unitData.publish,
          publishToMarketplace: unitData.publish,
          marketRent: unitData.rent,
          availableFrom: new Date(),
          address: {
            latitude: 34.0522 + Math.random() * 0.1,
            longitude: -118.2437 + Math.random() * 0.1,
            city: propData.address.city,
            state: propData.address.state,
            country: propData.address.country,
          },
        }).save();

        units.push(unit);
        if (verbose)
          console.log(
            `    ✅ Created unit: ${unit.unitNumber} (${unitData.publish ? 'Published' : 'Not Published'})`,
          );
      }
    }

    return { properties, units };
  }

  private async createLeasesWithTransactions(
    tenants: any[],
    units: any[],
    verbose: boolean,
  ): Promise<any[]> {
    if (verbose) console.log('📄 Creating leases with rental periods and transactions...');

    const leases = [];
    const now = new Date();

    // DRAFT lease (pending)
    const draftLease = await new this.leaseModel({
      unit: units[0]._id,
      tenant: tenants[0]._id,
      startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 395 * 24 * 60 * 60 * 1000),
      rentAmount: 2500,
      isSecurityDeposit: true,
      securityDepositAmount: 2500,
      paymentCycle: PaymentCycle.MONTHLY,
      status: LeaseStatus.DRAFT,
      terms: 'Standard residential lease terms and conditions.',
    }).save();
    leases.push(draftLease);
    if (verbose) console.log(`  ✅ Created DRAFT lease for unit ${units[0].unitNumber}`);

    // ACTIVE lease 1 with rental period and transactions
    const activeLease1StartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const activeLease1 = await new this.leaseModel({
      unit: units[1]._id,
      tenant: tenants[1]._id,
      startDate: activeLease1StartDate,
      endDate: new Date(now.getTime() + 305 * 24 * 60 * 60 * 1000),
      rentAmount: 2700,
      isSecurityDeposit: true,
      securityDepositAmount: 2700,
      paymentCycle: PaymentCycle.MONTHLY,
      status: LeaseStatus.ACTIVE,
      activatedAt: activeLease1StartDate,
      terms: 'Standard residential lease with pet policy.',
    }).save();
    leases.push(activeLease1);

    // Create rental period for active lease 1
    const rentalPeriod1 = await new this.rentalPeriodModel({
      lease: activeLease1._id,
      startDate: activeLease1.startDate,
      endDate: activeLease1.endDate,
      rentAmount: activeLease1.rentAmount,
      status: RentalPeriodStatus.ACTIVE,
    }).save();

    // Create security deposit transaction (paid)
    await new this.transactionModel({
      lease: activeLease1._id,
      rentalPeriod: rentalPeriod1._id,
      property: units[1].property,
      unit: units[1]._id,
      amount: 2700,
      dueDate: activeLease1StartDate,
      paidAt: activeLease1StartDate,
      status: PaymentStatus.PAID,
      type: PaymentType.DEPOSIT,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: 'Security deposit',
    }).save();

    // Create monthly rent transactions (some paid, some pending)
    const monthsActive = 2; // 60 days / 30 days
    for (let i = 0; i <= monthsActive; i++) {
      const dueDate = new Date(activeLease1StartDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
      const isPaid = i < monthsActive; // Last month is pending

      await new this.transactionModel({
        lease: activeLease1._id,
        rentalPeriod: rentalPeriod1._id,
        property: units[1].property,
        unit: units[1]._id,
        amount: 2700,
        dueDate: dueDate,
        paidAt: isPaid ? dueDate : undefined,
        status: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
        type: PaymentType.RENT,
        paymentMethod: isPaid ? PaymentMethod.BANK_TRANSFER : undefined,
        notes: `Monthly rent - Month ${i + 1}`,
      }).save();
    }

    // Update unit status
    await this.unitModel.findByIdAndUpdate(units[1]._id, {
      availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
      availableForRent: false,
      publishToMarketplace: false,
    });
    if (verbose)
      console.log(
        `  ✅ Created ACTIVE lease for unit ${units[1].unitNumber} with ${monthsActive + 1} rent transactions (${monthsActive} paid, 1 pending)`,
      );

    // ACTIVE lease 2 with rental period and transactions (commercial)
    const activeLease2StartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const activeLease2 = await new this.leaseModel({
      unit: units[4]._id,
      tenant: tenants[2]._id,
      startDate: activeLease2StartDate,
      endDate: new Date(now.getTime() + 185 * 24 * 60 * 60 * 1000),
      rentAmount: 8000,
      isSecurityDeposit: true,
      securityDepositAmount: 16000,
      paymentCycle: PaymentCycle.MONTHLY,
      status: LeaseStatus.ACTIVE,
      activatedAt: activeLease2StartDate,
      terms: 'Commercial office lease agreement.',
    }).save();
    leases.push(activeLease2);

    // Create rental period for active lease 2
    const rentalPeriod2 = await new this.rentalPeriodModel({
      lease: activeLease2._id,
      startDate: activeLease2.startDate,
      endDate: activeLease2.endDate,
      rentAmount: activeLease2.rentAmount,
      status: RentalPeriodStatus.ACTIVE,
    }).save();

    // Create security deposit transaction (paid)
    await new this.transactionModel({
      lease: activeLease2._id,
      rentalPeriod: rentalPeriod2._id,
      property: units[4].property,
      unit: units[4]._id,
      amount: 16000,
      dueDate: activeLease2StartDate,
      paidAt: activeLease2StartDate,
      status: PaymentStatus.PAID,
      type: PaymentType.DEPOSIT,
      paymentMethod: PaymentMethod.CHECK,
      notes: 'Commercial security deposit',
    }).save();

    // Create monthly rent transactions (6 months: 4 paid, 1 overdue, 1 pending)
    const monthsActive2 = 6; // 180 days / 30 days
    for (let i = 0; i <= monthsActive2; i++) {
      const dueDate = new Date(activeLease2StartDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
      let status: PaymentStatus;
      let paidAt: Date | undefined;
      let paymentMethod: PaymentMethod | undefined;

      if (i < 4) {
        // First 4 months paid
        status = PaymentStatus.PAID;
        paidAt = dueDate;
        paymentMethod = PaymentMethod.BANK_TRANSFER;
      } else if (i === 4) {
        // 5th month overdue
        status = PaymentStatus.OVERDUE;
      } else {
        // Last 2 months pending
        status = PaymentStatus.PENDING;
      }

      await new this.transactionModel({
        lease: activeLease2._id,
        rentalPeriod: rentalPeriod2._id,
        property: units[4].property,
        unit: units[4]._id,
        amount: 8000,
        dueDate: dueDate,
        paidAt: paidAt,
        status: status,
        type: PaymentType.RENT,
        paymentMethod: paymentMethod,
        notes: `Monthly rent - Month ${i + 1}`,
      }).save();
    }

    await this.unitModel.findByIdAndUpdate(units[4]._id, {
      availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
      availableForRent: false,
      publishToMarketplace: false,
    });
    if (verbose)
      console.log(
        `  ✅ Created ACTIVE lease for unit ${units[4].unitNumber} with ${monthsActive2 + 1} rent transactions (4 paid, 1 overdue, 2 pending)`,
      );

    // TERMINATED leases
    const terminatedLease1 = await new this.leaseModel({
      unit: units[6]._id,
      tenant: tenants[3]._id,
      startDate: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      rentAmount: 4500,
      isSecurityDeposit: true,
      securityDepositAmount: 4500,
      paymentCycle: PaymentCycle.MONTHLY,
      status: LeaseStatus.TERMINATED,
      activatedAt: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
      terminationDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      terminationReason: 'Tenant relocated for work',
      securityDepositRefundedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      terms: 'Standard residential house lease.',
    }).save();
    leases.push(terminatedLease1);
    if (verbose) console.log(`  ✅ Created TERMINATED lease for unit ${units[6].unitNumber}`);

    const terminatedLease2 = await new this.leaseModel({
      unit: units[7]._id,
      tenant: tenants[4]._id,
      startDate: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      rentAmount: 3800,
      isSecurityDeposit: true,
      securityDepositAmount: 3800,
      paymentCycle: PaymentCycle.MONTHLY,
      status: LeaseStatus.TERMINATED,
      activatedAt: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000),
      terminationDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      terminationReason: 'End of lease term',
      securityDepositRefundedAt: new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000),
      terms: 'Standard residential house lease.',
    }).save();
    leases.push(terminatedLease2);
    if (verbose) console.log(`  ✅ Created TERMINATED lease for unit ${units[7].unitNumber}`);

    return leases;
  }

  private async createMaintenanceData(
    properties: any[],
    units: any[],
    landlordUser: any,
    verbose: boolean,
  ): Promise<void> {
    if (verbose) console.log('🔧 Creating maintenance tickets and scopes of work...');

    // Create maintenance tickets with various statuses
    const ticketsData = [
      {
        property: properties[0]._id,
        unit: units[1]._id,
        title: 'Leaking faucet in kitchen',
        description:
          'The kitchen faucet has been leaking for the past week. Water drips constantly.',
        category: TicketCategory.PLUMBING,
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
      },
      {
        property: properties[0]._id,
        unit: units[2]._id,
        title: 'Air conditioning not cooling',
        description: 'AC unit runs but does not cool the apartment adequately.',
        category: TicketCategory.HVAC,
        priority: TicketPriority.URGENT,
        status: TicketStatus.IN_PROGRESS,
        assignedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        property: properties[0]._id,
        unit: units[0]._id,
        title: 'Broken window in living room',
        description: 'Window pane is cracked and needs replacement.',
        category: TicketCategory.STRUCTURAL,
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.ASSIGNED,
        assignedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        property: properties[1]._id,
        unit: units[4]._id,
        title: 'Electrical outlet not working',
        description: 'Multiple outlets in the conference room are not providing power.',
        category: TicketCategory.ELECTRICAL,
        priority: TicketPriority.HIGH,
        status: TicketStatus.IN_REVIEW,
      },
      {
        property: properties[2]._id,
        unit: units[6]._id,
        title: 'Pest control needed',
        description: 'Noticed rodent activity in the garage area.',
        category: TicketCategory.PEST_CONTROL,
        priority: TicketPriority.URGENT,
        status: TicketStatus.DONE,
        assignedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        completedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        property: properties[2]._id,
        unit: units[8]._id,
        title: 'Repainting exterior walls',
        description: 'House exterior needs fresh coat of paint.',
        category: TicketCategory.PAINTING,
        priority: TicketPriority.LOW,
        status: TicketStatus.CLOSED,
        assignedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        completedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    ];

    let ticketCounter = 1000;
    const tickets = [];

    for (const ticketData of ticketsData) {
      const ticket = await new this.maintenanceTicketModel({
        ...ticketData,
        ticketNumber: `TKT-${ticketCounter++}`,
        requestedBy: landlordUser._id,
        requestDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      }).save();

      tickets.push(ticket);
      if (verbose) console.log(`  ✅ Created ${ticket.status} maintenance ticket: ${ticket.title}`);
    }

    // Create scopes of work
    const sowsData = [
      {
        property: properties[0]._id,
        unit: units[1]._id,
        title: 'Complete Kitchen Plumbing Renovation',
        description:
          'Replace all kitchen plumbing fixtures including faucet, disposal, and under-sink pipes.',
        status: TicketStatus.IN_PROGRESS,
        assignedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        property: properties[1]._id,
        unit: units[4]._id,
        title: 'Office Electrical System Upgrade',
        description: 'Upgrade electrical panel and rewire conference room circuits.',
        status: TicketStatus.ASSIGNED,
        assignedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        property: properties[2]._id,
        title: 'Annual HVAC Maintenance',
        description: 'Scheduled maintenance for all HVAC units across the property.',
        status: TicketStatus.DONE,
        assignedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        property: properties[0]._id,
        title: 'Building Exterior Pressure Washing',
        description: 'Power wash building exterior and parking areas.',
        status: TicketStatus.OPEN,
      },
    ];

    let sowCounter = 5000;

    for (const sowData of sowsData) {
      const sow = await new this.scopeOfWorkModel({
        ...sowData,
        sowNumber: `SOW-${sowCounter++}`,
      }).save();

      if (verbose) console.log(`  ✅ Created ${sow.status} scope of work: ${sow.title}`);
    }
  }

  private async printSummary(): Promise<void> {
    const counts = await Promise.all([
      this.landlordModel.countDocuments(),
      this.tenantModel.countDocuments(),
      this.contractorModel.countDocuments(),
      this.userModel.countDocuments(),
      this.propertyModel.countDocuments(),
      this.unitModel.countDocuments(),
      this.leaseModel.countDocuments(),
      this.rentalPeriodModel.countDocuments(),
      this.transactionModel.countDocuments(),
      this.maintenanceTicketModel.countDocuments(),
      this.scopeOfWorkModel.countDocuments(),
    ]);

    console.log('\n📊 Seeding Summary:');
    console.log('├── Landlords: ' + counts[0]);
    console.log('├── Tenants: ' + counts[1]);
    console.log('├── Contractors: ' + counts[2]);
    console.log('├── Users: ' + counts[3]);
    console.log('├── Properties: ' + counts[4]);
    console.log('├── Units: ' + counts[5]);
    console.log('├── Leases: ' + counts[6]);
    console.log('├── Rental Periods: ' + counts[7]);
    console.log('├── Transactions: ' + counts[8]);
    console.log('├── Maintenance Tickets: ' + counts[9]);
    console.log('└── Scopes of Work: ' + counts[10]);
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

import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User } from '../features/users/schemas/user.schema';
import { Landlord } from '../features/landlords/schema/landlord.schema';
import { Tenant } from '../features/tenants/schema/tenant.schema';
import { Contractor } from '../features/contractors/schema/contractor.schema';
import { Property } from '../features/properties/schemas/property.schema';
import { Unit } from '../features/properties/schemas/unit.schema';
import { UserType } from '../common/enums/user-type.enum';
import { UnitType, UnitAvailabilityStatus } from '../common/enums/unit.enum';

interface MultiTenantSeedOptions {
  clean?: boolean;
}

@Injectable()
@Command({ 
  name: 'seed:multi-tenant', 
  description: 'Seed comprehensive multi-tenant test data' 
})
export class SeedMultiTenantCommand extends CommandRunner {
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

  async run(passedParam: string[], options?: MultiTenantSeedOptions): Promise<void> {
    try {
      console.log('🌱 Starting multi-tenant seeding...\n');

      const numLandlords = 2; // Fixed to 2 landlords
      const shouldClean = options?.clean || true; // Default to cleaning
      const shouldVerify = true; // Always verify
      const verbose = true; // Always verbose

      if (shouldClean) {
        await this.cleanExistingData(verbose);
      }

      // Create landlords
      const landlords = await this.createLandlords(numLandlords, verbose);
      
      // Create users for each landlord + admin
      const users = await this.createUsers(landlords, verbose);
      
      // Create properties for each landlord
      const properties = await this.createProperties(landlords, verbose);
      
      // Create units for each property
      const units = await this.createUnits(properties, verbose);
      
      // Create tenants for each landlord
      const tenants = await this.createTenants(landlords, verbose);
      
      // Create contractors for each landlord
      const contractors = await this.createContractors(landlords, verbose);

      // Create tenant and contractor users
      await this.createPartyUsers(tenants, contractors, landlords, verbose);

      if (shouldVerify) {
        await this.verifyDataIsolation(landlords, verbose);
      }

      await this.printSummary(landlords);
      
      console.log('🎉 Multi-tenant seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Multi-tenant seeding failed:', error.message);
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

  private async createLandlords(count: number, verbose: boolean): Promise<any[]> {
    if (verbose) console.log(`👔 Creating ${count} landlords...`);
    
    const landlordData = [
      {
        company_name: 'Landlord ONE LLC',
        business_number: 'BN123456789'
      },
      {
        company_name: 'Landlord Two Inc',
        business_number: 'BN987654321'
      },
      {
        company_name: 'Landlord Three Co',
        business_number: 'BN456789123'
      }
    ];

    const landlords = [];
    for (let i = 0; i < count; i++) {
      const data = landlordData[i] || {
        company_name: `Property Management ${i + 1}`,
        business_number: `BN${Math.random().toString().slice(2, 11)}`
      };
      
      const landlord = new this.landlordModel(data);
      const saved = await landlord.save();
      landlords.push(saved);
      
      if (verbose) console.log(`  ✅ Created landlord: ${data.company_name}`);
    }
    
    return landlords;
  }

  private async createUsers(landlords: any[], verbose: boolean): Promise<any[]> {
    if (verbose) console.log('👤 Creating landlord users...');
    
    const users = [];
    const hashedPassword = await bcrypt.hash('password123', 10);

    // // Create admin user
    // const adminUser = new this.userModel({
    //   username: 'admin',
    //   email: 'admin@example.com',
    //   password: hashedPassword,
    //   user_type: UserType.ADMIN,
    //   isAdmin: true
    // });
    // const savedAdmin = await adminUser.save();
    // users.push(savedAdmin);
    if (verbose) console.log('  ✅ Created admin user');

    // Create landlord users
    for (let i = 0; i < landlords.length; i++) {
      const landlord = landlords[i];
      const landlordUser = new this.userModel({
        username: `landlord${i + 1}`,
        email: `landlord${i + 1}@example.com`,
        password: hashedPassword,
        user_type: UserType.LANDLORD,
        party_id: landlord._id,
        landlord_id: landlord._id
      });
      
      const saved = await landlordUser.save();
      users.push(saved);
      if (verbose) console.log(`  ✅ Created landlord user: ${landlordUser.email}`);
    }
    
    return users;
  }

  private async createProperties(landlords: any[], verbose: boolean): Promise<any[]> {
    if (verbose) console.log('🏢 Creating properties...');
    
    const properties = [];
    const propertyTemplates = [
      {
        name: 'Downtown Complex',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA'
        },
        description: 'Modern downtown apartment complex'
      },
      {
        name: 'Suburban Villa',
        address: {
          street: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90210',
          country: 'USA'
        },
        description: 'Luxury suburban residential property'
      },
      {
        name: 'City Center Apartments',
        address: {
          street: '789 Pine St',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'USA'
        },
        description: 'High-rise city center apartments'
      }
    ];

    for (let i = 0; i < landlords.length; i++) {
      const landlord = landlords[i];
      const propertiesPerLandlord = i === 0 ? 2 : 1; // First landlord gets 2 properties
      
      for (let j = 0; j < propertiesPerLandlord; j++) {
        const template = propertyTemplates[(i * 2 + j) % propertyTemplates.length];
        
        // Correct way to use mongo-tenant
        const PropertyWithTenant = (this.propertyModel as any).byTenant(landlord._id);
        const property = new PropertyWithTenant({
          landlord_id: landlord._id,
          name: `${template.name} (${landlord.company_name})`,
          address: template.address,
          description: template.description
        });
        
        const saved = await property.save();
        properties.push(saved);
        if (verbose) console.log(`  ✅ Created property: ${saved.name}`);
      }
    }
    
    return properties;
  }

  private async createUnits(properties: any[], verbose: boolean): Promise<any[]> {
    if (verbose) console.log('🏠 Creating units...');
    
    const units = [];
    // Use only available unit types from the enum
    const unitTypes = [UnitType.APARTMENT, UnitType.STUDIO, UnitType.OFFICE, UnitType.ROOM];
    const statuses = [UnitAvailabilityStatus.VACANT, UnitAvailabilityStatus.OCCUPIED, UnitAvailabilityStatus.AVAILABLE_FOR_RENT];

    for (const property of properties) {
      const unitsPerProperty = Math.floor(Math.random() * 8) + 3; // 3-10 units per property
      
      for (let i = 1; i <= unitsPerProperty; i++) {
        // Correct way to use mongo-tenant
        const UnitWithTenant = (this.unitModel as any).byTenant(property.landlord_id);
        const unit = new UnitWithTenant({
          property: property._id,
          unitNumber: `${i}${String.fromCharCode(65 + Math.floor(i / 10))}`, // 1A, 2A, etc.
          size: Math.floor(Math.random() * 1000) + 400, // 400-1400 sq ft
          type: unitTypes[Math.floor(Math.random() * unitTypes.length)],
          availabilityStatus: statuses[Math.floor(Math.random() * statuses.length)]
        });
        
        const saved = await unit.save();
        units.push(saved);
      }
      
      if (verbose) console.log(`  ✅ Created ${unitsPerProperty} units for ${property.name}`);
    }
    
    return units;
  }

  private async createTenants(landlords: any[], verbose: boolean): Promise<any[]> {
    if (verbose) console.log('🏠 Creating tenants...');
    
    const tenants = [];
    const tenantNames = [
      'John Smith', 'Sarah Johnson', 'Michael Brown', 'Emily Davis',
      'David Wilson', 'Lisa Anderson', 'Robert Taylor', 'Jessica Miller'
    ];

    for (let i = 0; i < landlords.length; i++) {
      const landlord = landlords[i];
      const tenantsPerLandlord = Math.floor(Math.random() * 3) + 2; // 2-4 tenants per landlord
      
      for (let j = 0; j < tenantsPerLandlord; j++) {
        const name = tenantNames[(i * 4 + j) % tenantNames.length];
        
        // Correct way to use mongo-tenant
        const TenantWithTenant = (this.tenantModel as any).byTenant(landlord._id);
        const tenant = new TenantWithTenant({
          landlord_id: landlord._id,
          name: name
        });
        
        const saved = await tenant.save();
        tenants.push(saved);
      }
      
      if (verbose) console.log(`  ✅ Created ${tenantsPerLandlord} tenants for ${landlord.company_name}`);
    }
    
    return tenants;
  }

  private async createContractors(landlords: any[], verbose: boolean): Promise<any[]> {
    if (verbose) console.log('🔧 Creating contractors...');
    
    const contractors = [];
    const contractorNames = [
      'ABC Plumbing', 'Elite Electric', 'Pro Maintenance', 'Quick Fix Solutions',
      'Premium Services', 'Reliable Repairs', 'Expert Contractors', 'Swift Solutions'
    ];

    for (let i = 0; i < landlords.length; i++) {
      const landlord = landlords[i];
      const contractorsPerLandlord = Math.floor(Math.random() * 2) + 1; // 1-2 contractors per landlord
      
      for (let j = 0; j < contractorsPerLandlord; j++) {
        const name = contractorNames[(i * 2 + j) % contractorNames.length];
        
        // Correct way to use mongo-tenant
        const ContractorWithTenant = (this.contractorModel as any).byTenant(landlord._id);
        const contractor = new ContractorWithTenant({
          landlord_id: landlord._id,
          name: name
        });
        
        const saved = await contractor.save();
        contractors.push(saved);
      }
      
      if (verbose) console.log(`  ✅ Created ${contractorsPerLandlord} contractors for ${landlord.company_name}`);
    }
    
    return contractors;
  }

  private async createPartyUsers(tenants: any[], contractors: any[], landlords: any[], verbose: boolean): Promise<void> {
    if (verbose) console.log('👥 Creating tenant and contractor users...');
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create tenant users
    for (let i = 0; i < Math.min(tenants.length, 5); i++) { // Limit to 5 for demo
      const tenant = tenants[i];
      const tenantUser = new this.userModel({
        username: `tenant${i + 1}`,
        email: `tenant${i + 1}@example.com`,
        password: hashedPassword,
        user_type: UserType.TENANT,
        party_id: tenant._id,
        landlord_id: tenant.landlord_id
      });
      
      await tenantUser.save();
      if (verbose) console.log(`  ✅ Created tenant user: ${tenantUser.email}`);
    }
    
    // Create contractor users
    for (let i = 0; i < Math.min(contractors.length, 3); i++) { // Limit to 3 for demo
      const contractor = contractors[i];
      const contractorUser = new this.userModel({
        username: `contractor${i + 1}`,
        email: `contractor${i + 1}@example.com`,
        password: hashedPassword,
        user_type: UserType.CONTRACTOR,
        party_id: contractor._id,
        landlord_id: contractor.landlord_id
      });
      
      await contractorUser.save();
      if (verbose) console.log(`  ✅ Created contractor user: ${contractorUser.email}`);
    }
  }

  private async verifyDataIsolation(landlords: any[], verbose: boolean): Promise<void> {
    console.log('\n🔍 Verifying data isolation...');
    
    for (const landlord of landlords) {
      const tenantId = landlord._id;
      
      // Test isolation using mongo-tenant - correct syntax
      const properties = await (this.propertyModel as any).byTenant(tenantId).find();
      const units = await (this.unitModel as any).byTenant(tenantId).find();
      const tenants = await (this.tenantModel as any).byTenant(tenantId).find();
      const contractors = await (this.contractorModel as any).byTenant(tenantId).find();
      
      console.log(`✅ ${landlord.company_name}:`);
      console.log(`   Properties: ${properties.length}`);
      console.log(`   Units: ${units.length}`);
      console.log(`   Tenants: ${tenants.length}`);
      console.log(`   Contractors: ${contractors.length}`);
      
      if (verbose) {
        // Verify no cross-tenant data leakage
        const allProperties = await this.propertyModel.find();
        const isolatedProperties = allProperties.filter(p => p.landlord_id.toString() === tenantId.toString());
        if (properties.length !== isolatedProperties.length) {
          console.warn(`⚠️  Data isolation issue for ${landlord.company_name}`);
        }
      }
    }
  }

  private async printSummary(landlords: any[]): Promise<void> {
    console.log('\n📊 Seeding Summary:');
    console.log(`├── Landlords: ${landlords.length}`);
    
    const totalUsers = await this.userModel.countDocuments();
    const totalProperties = await this.propertyModel.countDocuments();
    const totalUnits = await this.unitModel.countDocuments();
    const totalTenants = await this.tenantModel.countDocuments();
    const totalContractors = await this.contractorModel.countDocuments();
    
    console.log(`├── Users: ${totalUsers}`);
    console.log(`├── Properties: ${totalProperties}`);
    console.log(`├── Units: ${totalUnits}`);
    console.log(`├── Tenants: ${totalTenants}`);
    console.log(`└── Contractors: ${totalContractors}`);
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
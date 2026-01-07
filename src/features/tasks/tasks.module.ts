import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { LeasesModule } from '../leases/leases.module';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertiesModule } from '../properties/properties.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { TasksController } from './controllers/tasks.controller';
import { Task, TaskSchema } from './schemas/task.schema';
import { TasksService } from './services/tasks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Lease.name, schema: LeaseSchema },
    ]),
    CaslModule,
    PropertiesModule,
    TenantsModule,
    forwardRef(() => LeasesModule),
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

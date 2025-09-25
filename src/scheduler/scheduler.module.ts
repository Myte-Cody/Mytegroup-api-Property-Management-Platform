import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LeasesModule } from '../features/leases/leases.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), LeasesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}

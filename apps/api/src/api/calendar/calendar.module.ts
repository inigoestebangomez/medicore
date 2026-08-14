// apps/api/src/api/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CalendarController } from './calendar.controller';
import { CalendarSyncController } from './calendar-sync.controller';
import { PublicBookingController } from './public-booking.controller';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaCalendarEventRepository } from '@/infrastructure/database/repositories/calendar-event.repository';
import { PrismaCalendarTokenRepository } from '@/infrastructure/database/repositories/calendar-token.repository';
import { CalendarSourceMapperService } from '@/infrastructure/calendar/calendar-source-mapper.service';
import { CalendarSyncService } from '@/infrastructure/calendar/calendar-sync.service';
import { GoogleCalendarAdapter } from '@/infrastructure/calendar/providers/google-calendar.adapter';
import { MicrosoftCalendarAdapter } from '@/infrastructure/calendar/providers/microsoft-calendar.adapter';
import { ICloudCalendarAdapter } from '@/infrastructure/calendar/providers/icloud-calendar.adapter';
import { AuthModule } from '@/api/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule.forRoot()],
  controllers: [CalendarController, CalendarSyncController, PublicBookingController],
  providers: [
    { provide: 'ICalendarEventRepository', useClass: PrismaCalendarEventRepository },
    { provide: 'ICalendarTokenRepository', useClass: PrismaCalendarTokenRepository },
    CalendarSourceMapperService,
    CalendarSyncService,
    GoogleCalendarAdapter,
    MicrosoftCalendarAdapter,
    ICloudCalendarAdapter,
    {
      provide: 'CALENDAR_PROVIDERS',
      useFactory: (google: GoogleCalendarAdapter, ms: MicrosoftCalendarAdapter, icloud: ICloudCalendarAdapter) => [google, ms, icloud],
      inject: [GoogleCalendarAdapter, MicrosoftCalendarAdapter, ICloudCalendarAdapter],
    },
  ],
})
export class CalendarModule {}

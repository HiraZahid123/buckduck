import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { WindowsModule } from './windows/windows.module';
import { OrdersModule } from './orders/orders.module';
import { MerchantModule } from './merchant/merchant.module';
import { DriverModule } from './driver/driver.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StoresModule,
    ProductsModule,
    WindowsModule,
    OrdersModule,
    MerchantModule,
    DriverModule,
    AdminModule,
    SettingsModule,
    EventsModule,
  ],
})
export class AppModule {}

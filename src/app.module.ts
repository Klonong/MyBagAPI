import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { PrismaModule } from './database/prisma.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AuthModule,
    CartModule,
    CategoriesModule,
    ProductsModule,
    WishlistModule,
    OrdersModule,
    AddressesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

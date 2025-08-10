import { Module } from "@nestjs/common";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./features/auth/auth.module";
import { EmailModule } from "./features/email/email.module";
import { OrganizationsModule } from "./features/organizations/organizations.module";
import { UsersModule } from "./features/users/users.module";
import { PropertiesModule } from "./features/properties/properties.module";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes env variables available everywhere
    }),
    CommonModule,
    AuthModule,
    EmailModule,
    OrganizationsModule,
    UsersModule,
    PropertiesModule,
    MongooseModule.forRoot(process.env.DB_URL),
  ],
})
export class AppModule {}

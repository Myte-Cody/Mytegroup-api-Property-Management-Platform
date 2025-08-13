import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { OrganizationType } from "../../../common/enums/organization.enum";
import { ApiProperty } from "@nestjs/swagger";
import { TransformToLowercase } from "../../../common/decorators/transform-to-lowercase.decorator";

export class CreateOrganizationDto {
  @ApiProperty({
    example: "Acme Property Management",
    description: "Organization name (will be stored as lowercase)",
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @TransformToLowercase()
  name: string;

  @ApiProperty({
    example: "PROPERTY_MANAGER",
    description: "Type of organization",
    enum: OrganizationType,
    enumName: "OrganizationType",
  })
  @IsEnum(OrganizationType)
  type: OrganizationType;
}

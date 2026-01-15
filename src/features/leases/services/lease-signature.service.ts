import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { ClientSession, Types } from 'mongoose';
import { LeaseStatus, SignatureTokenStatus } from '../../../common/enums/lease.enum';
import { UserType } from '../../../common/enums/user-type.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { SessionService } from '../../../common/services/session.service';
import { LeaseSignatureEmailService } from '../../email/services/lease-signature-email.service';
import { User } from '../../users/schemas/user.schema';
import { LeaseSignatureToken } from '../schemas/lease-signature-token.schema';
import { Lease } from '../schemas/lease.schema';
import { LeasePdfService } from './lease-pdf.service';
import { LeasesService } from './leases.service';

export interface SignatureTokenInfo {
  token: string;
  expiresAt: Date;
  signatureUrl: string;
}

export interface TenantSignatureRequest {
  signatureName: string;
  signatureData?: string;
  agreedToTerms: boolean;
}

export interface SignatureValidationResult {
  lease: any;
  tenant: any;
  property: any;
  unit: any;
  isValid: boolean;
}

@Injectable()
export class LeaseSignatureService {
  private readonly logger = new Logger(LeaseSignatureService.name);
  private readonly tokenExpiryHours: number;
  private readonly frontendUrl: string;

  constructor(
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(LeaseSignatureToken.name)
    private readonly signatureTokenModel: AppModel<LeaseSignatureToken>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly leasePdfService: LeasePdfService,
    private readonly signatureEmailService: LeaseSignatureEmailService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => LeasesService))
    private readonly leasesService: LeasesService,
  ) {
    this.tokenExpiryHours = this.configService.get<number>('SIGNATURE_TOKEN_EXPIRY_HOURS') || 72;
    this.frontendUrl = this.configService.get<string>('CLIENT_BASE_URL') || 'http://localhost:3000';
  }

  async sendForSignature(leaseId: string, currentUser: User): Promise<SignatureTokenInfo> {
    return this.sessionService.withSession(async (session: ClientSession) => {
      const lease = await this.leaseModel
        .findById(leaseId)
        .populate('tenant')
        .populate({
          path: 'unit',
          populate: { path: 'property' },
        })
        .populate('landlord')
        .session(session)
        .exec();

      if (!lease) {
        throw new NotFoundException('Lease not found');
      }

      // Validate lease can be sent for signature
      if (lease.status !== LeaseStatus.DRAFT && lease.status !== LeaseStatus.PENDING_SIGNATURE) {
        throw new BadRequestException(
          'Only draft or pending signature leases can be sent for signature',
        );
      }

      // Invalidate any existing pending tokens for this lease
      await this.invalidatePendingTokens(leaseId, 'New signature request created', session);

      // Generate new token
      const token = this.generateSecureToken();
      const tokenHash = this.hashToken(token);
      const expiresAt = new Date(Date.now() + this.tokenExpiryHours * 60 * 60 * 1000);
      const pdfVersionHash = this.leasePdfService.generateLeaseContentHash(lease);

      const signatureToken = new this.signatureTokenModel({
        lease: lease._id,
        tenant: lease.tenant._id || lease.tenant,
        landlord: lease.landlord._id || lease.landlord,
        tokenHash,
        status: SignatureTokenStatus.PENDING,
        expiresAt,
        pdfVersionHash,
      });

      await signatureToken.save({ session });

      // Update lease status and track when signature was requested
      lease.status = LeaseStatus.PENDING_SIGNATURE;
      lease.signatureRequestedAt = new Date();
      await lease.save({ session });

      // Build signature URL
      const signatureUrl = `${this.frontendUrl}/sign/${token}`;

      // Extract populated data for email
      const tenant = lease.tenant as any;
      const tenantId = tenant?._id || lease.tenant;
      const unit = lease.unit as any;
      const property = unit?.property as any;
      const landlord = lease.landlord as any;

      // Get tenant's primary user email
      const primaryUser = await this.userModel
        .findOne({
          organization_id: tenantId,
          user_type: UserType.TENANT,
          isPrimary: true,
        })
        .session(session)
        .exec();

      if (!primaryUser?.email) {
        throw new BadRequestException(
          'Unable to send signature request: tenant has no primary user with email',
        );
      }

      // Send email notification
      await this.signatureEmailService.sendSignatureRequestEmail({
        tenantName: tenant?.name || primaryUser.firstName || 'Tenant',
        tenantEmail: primaryUser.email,
        landlordName: landlord?.name || landlord?.organizationName || 'Property Manager',
        propertyName: property?.name || 'Property',
        unitIdentifier: unit?.unitNumber || '',
        propertyAddress: property?.address || '',
        signatureUrl,
        expiresAt,
        leaseStartDate: lease.startDate,
        leaseEndDate: lease.endDate,
        monthlyRent: lease.rentAmount,
      });

      this.logger.log(`Signature request sent for lease ${leaseId} to ${tenant?.email}`);

      return {
        token,
        expiresAt,
        signatureUrl,
      };
    });
  }

  async validateToken(token: string): Promise<SignatureValidationResult> {
    const tokenHash = this.hashToken(token);
    const signatureToken = await this.signatureTokenModel
      .findOne({ tokenHash })
      .populate({
        path: 'lease',
        populate: [
          {
            path: 'unit',
            populate: { path: 'property' },
          },
          { path: 'tenant' },
          { path: 'landlord' },
        ],
      })
      .exec();

    if (!signatureToken) {
      throw new NotFoundException('Invalid or expired signature link');
    }

    if (signatureToken.status !== SignatureTokenStatus.PENDING) {
      throw new BadRequestException(
        signatureToken.status === SignatureTokenStatus.USED
          ? 'This lease has already been signed'
          : 'This signature link is no longer valid',
      );
    }

    if (signatureToken.expiresAt < new Date()) {
      throw new BadRequestException('This signature link has expired');
    }

    const lease = signatureToken.lease as any;

    // Verify lease content hasn't changed
    const currentHash = this.leasePdfService.generateLeaseContentHash(lease);
    if (currentHash !== signatureToken.pdfVersionHash) {
      throw new BadRequestException(
        'The lease has been modified. Please request a new signature link from your landlord.',
      );
    }

    const unit = lease.unit as any;
    const property = unit?.property as any;
    const tenant = lease.tenant as any;

    return {
      lease,
      tenant,
      property,
      unit,
      isValid: true,
    };
  }

  async signLease(
    token: string,
    signatureRequest: TenantSignatureRequest,
    clientIp: string,
    userAgent: string,
  ): Promise<{ lease: Lease; signedPdfUrl: string }> {
    return this.sessionService.withSession(async (session: ClientSession) => {
      const tokenHash = this.hashToken(token);
      const signatureToken = await this.signatureTokenModel
        .findOne({ tokenHash })
        .populate({
          path: 'lease',
          populate: [
            { path: 'tenant' },
            { path: 'landlord' },
            {
              path: 'unit',
              populate: { path: 'property' },
            },
          ],
        })
        .session(session)
        .exec();

      if (!signatureToken || signatureToken.status !== SignatureTokenStatus.PENDING) {
        throw new BadRequestException('Invalid or already used signature link');
      }

      if (!signatureRequest.agreedToTerms) {
        throw new BadRequestException('You must agree to the terms to sign');
      }

      const lease = await this.leaseModel
        .findById(signatureToken.lease._id || signatureToken.lease)
        .session(session)
        .exec();

      if (!lease) {
        throw new NotFoundException('Lease not found');
      }

      const signedAt = new Date();

      // Generate and store signed PDF
      const { mediaId } = await this.leasePdfService.generateAndStorePdf(
        lease._id.toString(),
        {
          signedAt,
          signatureName: signatureRequest.signatureName,
          signatureImageData: signatureRequest.signatureData,
          signatureIp: clientIp,
        },
        null,
      );

      // Update lease with signature data
      lease.status = LeaseStatus.ACTIVE;
      lease.signedPdfId = new Types.ObjectId(mediaId);
      lease.signedAt = signedAt;
      lease.activatedAt = signedAt;
      lease.tenantSignatureName = signatureRequest.signatureName;
      lease.tenantSignatureData = signatureRequest.signatureData;
      lease.tenantSignatureIp = clientIp;
      lease.tenantSignatureUserAgent = userAgent;
      await lease.save({ session });

      // Activate the lease - creates rental periods, transactions, updates unit status
      await this.leasesService.activateLease(lease, session);

      // Mark token as used
      signatureToken.status = SignatureTokenStatus.USED;
      signatureToken.usedAt = signedAt;
      await signatureToken.save({ session });

      this.logger.log(`Lease ${lease._id} signed successfully by tenant`);

      return {
        lease,
        signedPdfUrl: `/api/leases/${lease._id}/signed-pdf`,
      };
    });
  }

  async invalidatePendingTokens(
    leaseId: string,
    reason: string,
    session?: ClientSession,
  ): Promise<number> {
    const result = await this.signatureTokenModel.updateMany(
      {
        lease: leaseId,
        status: SignatureTokenStatus.PENDING,
      },
      {
        status: SignatureTokenStatus.INVALIDATED,
        invalidatedAt: new Date(),
        invalidationReason: reason,
      },
      { session },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`Invalidated ${result.modifiedCount} pending tokens for lease ${leaseId}`);
    }

    return result.modifiedCount;
  }

  async getSignatureStatus(leaseId: string): Promise<{
    status: LeaseStatus;
    hasPendingToken: boolean;
    signedAt?: Date;
    signatureRequestedAt?: Date;
  }> {
    const lease = await this.leaseModel.findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const pendingToken = await this.signatureTokenModel
      .findOne({
        lease: leaseId,
        status: SignatureTokenStatus.PENDING,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    return {
      status: lease.status,
      hasPendingToken: !!pendingToken,
      signedAt: lease.signedAt,
      signatureRequestedAt: lease.signatureRequestedAt,
    };
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async sendSignatureConfirmationEmails(
    populatedLease: any,
    signedAt: Date,
  ): Promise<void> {
    const tenant = populatedLease.tenant;
    const landlord = populatedLease.landlord;
    const unit = populatedLease.unit;
    const property = unit?.property;

    const downloadUrl = `${this.frontendUrl}/dashboard/landlord/leases/${populatedLease._id}`;

    // Send to tenant
    if (tenant?.email) {
      await this.signatureEmailService.sendSignatureConfirmationEmail({
        recipientName: tenant.name || 'Tenant',
        recipientEmail: tenant.email,
        isTenant: true,
        propertyName: property?.name || 'Property',
        unitIdentifier: unit?.unitNumber || '',
        signedAt,
        signedBy: populatedLease.tenantSignatureName,
        downloadUrl,
      });
    }

    // Send to landlord (get user associated with landlord)
    if (landlord?.email) {
      await this.signatureEmailService.sendSignatureConfirmationEmail({
        recipientName: landlord.name || landlord.organizationName || 'Property Manager',
        recipientEmail: landlord.email,
        isTenant: false,
        propertyName: property?.name || 'Property',
        unitIdentifier: unit?.unitNumber || '',
        signedAt,
        signedBy: populatedLease.tenantSignatureName,
        downloadUrl,
      });
    }
  }
}

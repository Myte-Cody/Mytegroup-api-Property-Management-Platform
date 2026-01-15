import { Body, Controller, Get, Header, Ip, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SignLeaseDto } from './dto/sign-lease.dto';
import { LeasePdfService } from './services/lease-pdf.service';
import { LeaseSignatureService } from './services/lease-signature.service';

@ApiTags('Lease Signature')
@Controller('sign')
export class LeaseSignatureController {
  constructor(
    private readonly leaseSignatureService: LeaseSignatureService,
    private readonly leasePdfService: LeasePdfService,
  ) {}

  @Get(':token')
  @Public()
  @ApiOperation({ summary: 'Validate signature token and get lease details for signing' })
  @ApiParam({ name: 'token', description: 'Signature token from email link', type: String })
  @ApiResponse({
    status: 200,
    description: 'Token valid, lease details returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Token invalid, expired, or already used',
  })
  @ApiResponse({
    status: 404,
    description: 'Token not found',
  })
  async validateToken(@Param('token') token: string) {
    const result = await this.leaseSignatureService.validateToken(token);

    return {
      success: true,
      data: {
        lease: {
          id: result.lease._id,
          startDate: result.lease.startDate,
          endDate: result.lease.endDate,
          rentAmount: result.lease.rentAmount,
          paymentCycle: result.lease.paymentCycle,
          terms: result.lease.terms,
          securityDeposit: result.lease.isSecurityDeposit
            ? result.lease.securityDepositAmount
            : null,
        },
        tenant: {
          name: result.tenant?.name,
          email: result.tenant?.email,
        },
        property: {
          name: result.property?.name,
          address: result.property?.address,
        },
        unit: {
          unitNumber: result.unit?.unitNumber,
        },
      },
    };
  }

  @Get(':token/preview-pdf')
  @Public()
  @ApiOperation({ summary: 'Get PDF preview for tenant to review before signing' })
  @ApiParam({ name: 'token', description: 'Signature token', type: String })
  @ApiResponse({
    status: 200,
    description: 'PDF file',
  })
  @Header('Content-Type', 'application/pdf')
  async getPreviewPdf(@Param('token') token: string, @Res() res: Response) {
    // Validate token first
    const result = await this.leaseSignatureService.validateToken(token);

    // Generate preview PDF
    const pdfBuffer = await this.leasePdfService.generatePreviewPdf(result.lease._id.toString());

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="lease-preview.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Post(':token')
  @Public()
  @ApiOperation({ summary: 'Sign the lease agreement' })
  @ApiParam({ name: 'token', description: 'Signature token from email link', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lease signed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Token invalid, expired, or terms not agreed',
  })
  async signLease(
    @Param('token') token: string,
    @Body() signLeaseDto: SignLeaseDto,
    @Ip() clientIp: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const result = await this.leaseSignatureService.signLease(
      token,
      {
        signatureName: signLeaseDto.signatureName,
        signatureData: signLeaseDto.signatureData,
        agreedToTerms: signLeaseDto.agreedToTerms,
      },
      clientIp,
      userAgent,
    );

    return {
      success: true,
      data: {
        leaseId: result.lease._id,
        signedPdfUrl: result.signedPdfUrl,
        signedAt: result.lease.signedAt,
      },
      message: 'Lease signed successfully. You will receive a confirmation email shortly.',
    };
  }
}

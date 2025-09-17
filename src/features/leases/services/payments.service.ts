import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../../common/utils/pagination.utils';
import { MediaService } from '../../media/services/media.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { MarkPaymentPaidDto, UploadPaymentProofDto } from '../dto';
import { Lease } from '../schemas/lease.schema';
import { Payment } from '../schemas/payment.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { PaymentReferenceUtils } from '../utils/payment-reference.utils';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: AppModel<Payment>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    private readonly mediaService: MediaService,
  ) {}

  async findAllPaginated(queryDto: any, currentUser: UserDocument): Promise<any> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
      leaseId,
      rentalPeriodId,
      paymentMethod,
      reference,
      startDate,
      endDate,
    } = queryDto;

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      return createEmptyPaginatedResponse(page, limit);
    }

    let baseQuery = this.paymentModel.byTenant(landlordId).find();

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (type) {
      baseQuery = baseQuery.where({ type });
    }

    if (leaseId) {
      baseQuery = baseQuery.where({ lease: leaseId });
    }

    if (rentalPeriodId) {
      baseQuery = baseQuery.where({ rentalPeriod: rentalPeriodId });
    }

    if (paymentMethod) {
      baseQuery = baseQuery.where({ paymentMethod });
    }

    if (reference) {
      baseQuery = baseQuery.where({ reference: { $regex: reference, $options: 'i' } });
    }

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      baseQuery = baseQuery.where({ paymentDate: dateFilter });
    }

    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'lease',
          select: 'unit tenant property',
          populate: [
            { path: 'unit', select: 'unitNumber type' },
            { path: 'tenant', select: 'name' },
            { path: 'property', select: 'name address' },
          ],
        })
        .populate('rentalPeriod', 'startDate endDate rentAmount')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse(payments, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findById(id)
      .populate({
        path: 'lease',
        select: 'unit tenant property terms',
        populate: [
          { path: 'unit', select: 'unitNumber type' },
          { path: 'tenant', select: 'name' },
          { path: 'property', select: 'name address' },
        ],
      })
      .populate('rentalPeriod', 'startDate endDate rentAmount')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByReference(reference: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findOne({ reference })
      .populate({
        path: 'lease',
        select: 'unit tenant property terms',
        populate: [
          { path: 'unit', select: 'unitNumber type' },
          { path: 'tenant', select: 'name' },
          { path: 'property', select: 'name address' },
        ],
      })
      .populate('rentalPeriod', 'startDate endDate rentAmount')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${reference} not found`);
    }

    return payment;
  }

  async create(createPaymentDto: any, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Cannot create payment: No tenant context');
    }

    await this.validatePaymentCreation(createPaymentDto, landlordId);

    try {
      const reference = await this.generatePaymentReference(landlordId);

      const PaymentWithTenant = this.paymentModel.byTenant(landlordId);
      const newPayment = new PaymentWithTenant({
        ...createPaymentDto,
        reference,
      });
      return await newPayment.save();
    } catch (error: any) {
      if (error.code === 11000 && error.keyPattern?.reference) {
        throw new BadRequestException('Payment reference generation failed. Please try again.');
      }
      throw error;
    }
  }

  async update(id: string, updatePaymentDto: any, currentUser: UserDocument) {
    if (!updatePaymentDto || Object.keys(updatePaymentDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Find existing payment
    const existingPayment = await this.paymentModel.byTenant(landlordId).findById(id).exec();

    if (!existingPayment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (existingPayment.status === PaymentStatus.PROCESSED) {
      throw new BadRequestException('Cannot modify processed payments');
    }

    // Update the payment
    Object.assign(existingPayment, updatePaymentDto);
    return await existingPayment.save();
  }

  async processPayment(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const payment = await this.paymentModel.byTenant(landlordId).findById(id).exec();

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be processed');
    }

    payment.status = PaymentStatus.PROCESSED;
    payment.processedDate = new Date();

    // TODO: After payment is processed and marked as PAID, calculate and update
    // the nextPaymentDueDate in the associated lease based on payment cycle

    return await payment.save();
  }

  async remove(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Find payment
    const payment = await this.paymentModel.byTenant(landlordId).findById(id).exec();

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Only allow deletion of PENDING payments
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be deleted');
    }

    await this.paymentModel.byTenant(landlordId).findByIdAndDelete(id);
    return { message: 'Payment deleted successfully' };
  }

  // Analytics and Reporting Methods

  async getPaymentsByLease(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const payments = await this.paymentModel
      .byTenant(landlordId)
      .find({ lease: leaseId })
      .sort({ paymentDate: -1 })
      .populate('rentalPeriod', 'startDate endDate rentAmount')
      .exec();

    return payments;
  }

  async getPaymentSummary(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const payments = await this.paymentModel.byTenant(landlordId).find({ lease: leaseId }).exec();

    const summary = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      processedAmount: payments
        .filter((p) => p.status === PaymentStatus.PROCESSED)
        .reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: payments
        .filter((p) => p.status === PaymentStatus.PENDING)
        .reduce((sum, p) => sum + p.amount, 0),
      byType: {
        rent: payments.filter((p) => p.type === PaymentType.RENT).length,
        deposit: payments.filter((p) => p.type === PaymentType.DEPOSIT).length,
        fees: payments.filter((p) => p.type === PaymentType.FEES).length,
        utilities: payments.filter((p) => p.type === PaymentType.UTILITIES).length,
        maintenance: payments.filter((p) => p.type === PaymentType.MAINTENANCE).length,
        other: payments.filter((p) => p.type === PaymentType.OTHER).length,
      },
      byStatus: {
        pending: payments.filter((p) => p.status === PaymentStatus.PENDING).length,
        processed: payments.filter((p) => p.status === PaymentStatus.PROCESSED).length,
        failed: payments.filter((p) => p.status === PaymentStatus.FAILED).length,
      },
    };

    return summary;
  }

  // Helper Methods

  private async generatePaymentReference(landlordId: any): Promise<string> {
    return PaymentReferenceUtils.generatePaymentReference(this.paymentModel, landlordId);
  }

  private async validatePaymentCreation(createPaymentDto: any, landlordId: any) {
    // Validate lease exists
    const lease = await this.leaseModel
      .byTenant(landlordId)
      .findById(createPaymentDto.lease)
      .exec();
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (createPaymentDto.rentalPeriod) {
      const rentalPeriod = await this.rentalPeriodModel
        .byTenant(landlordId)
        .findById(createPaymentDto.rentalPeriod)
        .exec();
      if (!rentalPeriod) {
        throw new NotFoundException('RentalPeriod not found');
      }

      if (rentalPeriod.lease.toString() !== createPaymentDto.lease) {
        throw new BadRequestException('RentalPeriod does not belong to the specified lease');
      }
    }

    // Validate amount
    if (!createPaymentDto.amount || createPaymentDto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    // Validate payment date
    if (createPaymentDto.paymentDate && new Date(createPaymentDto.paymentDate) > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }
  }

  async submitPaymentProof(
    leaseId: string,
    rentalPeriodId: string,
    submitDto: UploadPaymentProofDto,
    currentUser: UserDocument,
  ): Promise<Payment> {
    const landlordId = this.getLandlordId(currentUser);

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findOne({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
      })
      .populate('lease rentalPeriod')
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found for this rental period');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment proof can only be submitted for pending payments');
    }

    if (new Date(submitDto.paymentDate) > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    const updatedPayment = await this.paymentModel
      .byTenant(landlordId)
      .findByIdAndUpdate(
        payment._id,
        {
          paymentMethod: submitDto.paymentMethod,
          paymentDate: submitDto.paymentDate,
          tenantNotes: submitDto.tenantNotes,
          paidDate: submitDto.paymentDate,
          status: PaymentStatus.PAID,
        },
        { new: true },
      )
      .populate('lease rentalPeriod')
      .exec();

    if (submitDto.media_files && submitDto.media_files.length > 0) {
      const uploadPromises = submitDto.media_files.map(async (file) => {
        return this.mediaService.upload(file, updatedPayment, currentUser, 'payment_proof');
      });

      await Promise.all(uploadPromises);
    }

    return updatedPayment;
  }

  async validatePayment(
    leaseId: string,
    rentalPeriodId: string,
    validateDto: MarkPaymentPaidDto,
    currentUser: UserDocument,
  ): Promise<Payment> {
    const landlordId = this.getLandlordId(currentUser);

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findOne({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
      })
      .populate('lease rentalPeriod')
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found for this rental period');
    }

    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Payment must be in PAID status to be validated');
    }

    if (new Date(validateDto.paymentDate) > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    const updatedPayment = await this.paymentModel
      .byTenant(landlordId)
      .findByIdAndUpdate(
        payment._id,
        {
          paymentMethod: validateDto.paymentMethod,
          paymentDate: validateDto.paymentDate,
          landlordNotes: validateDto.landlordNotes,
          landlordValidated: true,
          landlordValidatedDate: new Date(),
          processedDate: new Date(),
          status: PaymentStatus.PROCESSED,
        },
        { new: true },
      )
      .populate('lease rentalPeriod')
      .exec();

    return updatedPayment;
  }

  async getPaymentForRentalPeriod(
    leaseId: string,
    rentalPeriodId: string,
    currentUser: UserDocument,
  ): Promise<Payment> {
    const landlordId = this.getLandlordId(currentUser);

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findOne({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
      })
      .populate('lease rentalPeriod')
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found for this rental period');
    }

    return payment;
  }

  private getLandlordId(currentUser: UserDocument) {
    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : currentUser.tenantId;
  }
}

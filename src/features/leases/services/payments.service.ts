import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaymentCycle, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../../common/utils/pagination.utils';
import { MediaService } from '../../media/services/media.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { MarkPaymentPaidDto, UploadPaymentProofDto } from '../dto';
import { MarkPaymentAsPaidDto } from '../dto/mark-payment-as-paid.dto';
import { Lease } from '../schemas/lease.schema';
import { Payment } from '../schemas/payment.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { getFirstPaymentDueDate } from '../utils/payment-schedule.utils';

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


    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      baseQuery = baseQuery.where({ paidAt: dateFilter });
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


  async create(createPaymentDto: any, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Cannot create payment: No tenant context');
    }

    await this.validatePaymentCreation(createPaymentDto, landlordId);

    const PaymentWithTenant = this.paymentModel.byTenant(landlordId);

    // For manual payment creation, create single payment with provided or calculated due date
    let paymentData = { ...createPaymentDto };

    if (!createPaymentDto.dueDate && createPaymentDto.rentalPeriod) {
      // Fetch the rental period and lease to get the payment cycle
      const rentalPeriod = await this.rentalPeriodModel
        .byTenant(landlordId)
        .findById(createPaymentDto.rentalPeriod)
        .populate('lease')
        .exec();

      if (rentalPeriod && typeof rentalPeriod.lease === 'object') {
        const lease = rentalPeriod.lease as any;
        // For manual payment creation, use the first payment due date from the schedule
        paymentData.dueDate = getFirstPaymentDueDate(
          rentalPeriod.startDate,
          rentalPeriod.endDate,
          lease.paymentCycle
        );
      }
    }

    const newPayment = new PaymentWithTenant(paymentData);
    return await newPayment.save();
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
      .sort({ paidAt: -1 })
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
    if (createPaymentDto.paidAt && new Date(createPaymentDto.paidAt) > new Date()) {
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

    if (new Date(submitDto.paidAt) > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    const updatedPayment = await this.paymentModel
      .byTenant(landlordId)
      .findByIdAndUpdate(
        payment._id,
        {
          paymentMethod: submitDto.paymentMethod,
          paidAt: submitDto.paidAt,
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

  async markAsPaid(id: string, markAsPaidDto: MarkPaymentAsPaidDto, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findById(id)
      .populate('lease rentalPeriod')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Update payment status to PAID
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();

    if (markAsPaidDto.paymentMethod) {
      payment.paymentMethod = markAsPaidDto.paymentMethod;
    }

    if (markAsPaidDto.notes) {
      payment.notes = markAsPaidDto.notes;
    }

    await payment.save();

    return payment;
  }

  async markAsNotPaid(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const payment = await this.paymentModel
      .byTenant(landlordId)
      .findById(id)
      .populate('lease rentalPeriod')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Reset payment to default pending state
    payment.status = PaymentStatus.PENDING;
    payment.paidAt = undefined;
    payment.paymentMethod = undefined;
    payment.notes = undefined;

    await payment.save();

    return payment;
  }


  private getLandlordId(currentUser: UserDocument) {
    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : currentUser.tenantId;
  }
}

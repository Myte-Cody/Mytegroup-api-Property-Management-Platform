import { Injectable } from '@nestjs/common';
import { NotificationType } from '@shared/notification-types';
import {
  BaseNotificationData,
  FeedNewAnnouncementData,
  FeedNewPostData,
  FeedPostReactionData,
  LeaseActivatedData,
  LeaseExpiringSoonData,
  LeaseRenewalReminderData,
  LeaseTerminatedData,
  LeaseTermsUpdatedData,
  MaintenanceAssignedToContractorData,
  MaintenanceInvoiceData,
  MaintenanceNewRequestData,
  MaintenanceStatusChangedData,
  MessageGroupInviteData,
  MessageNewDirectData,
  MessageNewGroupData,
  VisitNewRequestData,
  VisitReminderData,
  VisitRescheduledData,
  VisitResponseData,
} from '../interfaces/notification-payload.interface';

export interface InAppContent {
  title: string;
  message: string;
  actionUrl?: string;
}

export interface SmsContent {
  message: string;
}

export interface EmailContent {
  templateName: string;
  templateData: Record<string, any>;
}

@Injectable()
export class NotificationContentMapper {
  /**
   * Get in-app notification content based on notification type and data
   */
  getInAppContent(
    notificationType: NotificationType,
    data: BaseNotificationData,
    actionUrl?: string,
  ): InAppContent {
    const content = this.getInAppContentByType(notificationType, data);
    return {
      ...content,
      actionUrl: actionUrl || content.actionUrl,
    };
  }

  /**
   * Get SMS message based on notification type and data
   */
  getSmsContent(notificationType: NotificationType, data: BaseNotificationData): SmsContent | null {
    return this.getSmsContentByType(notificationType, data);
  }

  /**
   * Get email template name and data based on notification type
   */
  getEmailContent(
    notificationType: NotificationType,
    data: BaseNotificationData,
  ): EmailContent | null {
    return this.getEmailContentByType(notificationType, data);
  }

  private getInAppContentByType(
    notificationType: NotificationType,
    data: BaseNotificationData,
  ): InAppContent {
    switch (notificationType) {
      // ========== LEASE ==========
      case NotificationType.LEASE_ACTIVATED: {
        const leaseData = data as LeaseActivatedData;
        return {
          title: 'Lease Activated',
          message: `Your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has been activated.`,
          actionUrl: '/dashboard/tenant/leases',
        };
      }

      case NotificationType.LEASE_TERMINATED: {
        const leaseData = data as LeaseTerminatedData;
        return {
          title: 'Lease Terminated',
          message: `Your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has been terminated.`,
          actionUrl: '/dashboard/tenant/leases',
        };
      }

      case NotificationType.LEASE_RENEWAL_REMINDER: {
        const leaseData = data as LeaseRenewalReminderData;
        const renewalType = leaseData.isAutoRenewal ? 'auto-renewed' : 'renewed';
        return {
          title: 'Lease Renewal',
          message: `Your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has been ${renewalType}.`,
          actionUrl: '/dashboard/tenant/leases',
        };
      }

      case NotificationType.LEASE_EXPIRING_SOON: {
        const leaseData = data as LeaseExpiringSoonData;
        const expiringMessage =
          leaseData.daysRemaining > 0
            ? `Your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} expires in ${leaseData.daysRemaining} days.`
            : `Your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has expired.`;
        return {
          title: 'Lease Expiring Soon',
          message: expiringMessage,
          actionUrl: '/dashboard/tenant/leases',
        };
      }

      case NotificationType.LEASE_TERMS_UPDATED: {
        const leaseData = data as LeaseTermsUpdatedData;
        return {
          title: 'Lease Terms Updated',
          message: `The terms for your lease at ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} have been updated.`,
          actionUrl: '/dashboard/tenant/leases',
        };
      }

      // ========== MAINTENANCE ==========
      case NotificationType.MAINTENANCE_NEW_REQUEST: {
        const maintenanceData = data as MaintenanceNewRequestData;
        return {
          title: 'New Maintenance Request',
          message: `🔧 New maintenance request "${maintenanceData.ticketTitle}" from ${maintenanceData.tenantName}.`,
          actionUrl: `/dashboard/landlord/maintenance/tickets/${maintenanceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_PENDING: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        return {
          title: 'Ticket Status: Pending',
          message: `Ticket "${maintenanceData.ticketTitle}" status changed to Pending.`,
          actionUrl: `/dashboard/tenant/maintenance/tickets/${maintenanceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_IN_PROGRESS: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        return {
          title: 'Work Started',
          message: `🔧 Work on "${maintenanceData.ticketTitle}" has started.`,
          actionUrl: `/dashboard/tenant/maintenance/tickets/${maintenanceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        return {
          title: 'Work Complete',
          message: `✅ Work on "${maintenanceData.ticketTitle}" is complete.`,
          actionUrl: `/dashboard/tenant/maintenance/tickets/${maintenanceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_CLOSED: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        return {
          title: 'Ticket Completed',
          message: `🎉 Your maintenance request "${maintenanceData.ticketTitle}" has been completed.`,
          actionUrl: `/dashboard/tenant/maintenance/tickets/${maintenanceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_ASSIGNED_TO_CONTRACTOR: {
        const maintenanceData = data as MaintenanceAssignedToContractorData;
        return {
          title: 'Contractor Assigned',
          message: `👷 Your maintenance request "${maintenanceData.ticketTitle}" has been assigned to ${maintenanceData.contractorName}.`,
          actionUrl: `/dashboard/tenant/maintenance/tickets/${maintenanceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_INVOICE_UPLOADED: {
        const invoiceData = data as MaintenanceInvoiceData;
        return {
          title: 'Invoice Uploaded',
          message: `Invoice uploaded for ticket "${invoiceData.ticketTitle}" by ${invoiceData.contractorName}.`,
          actionUrl: `/dashboard/landlord/maintenance/tickets/${invoiceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_INVOICE_APPROVED: {
        const invoiceData = data as MaintenanceInvoiceData;
        return {
          title: 'Invoice Approved',
          message: `Your invoice for ticket "${invoiceData.ticketTitle}" has been approved.`,
          actionUrl: `/dashboard/contractor/maintenance/tickets/${invoiceData.ticketId}`,
        };
      }

      case NotificationType.MAINTENANCE_INVOICE_REJECTED: {
        const invoiceData = data as MaintenanceInvoiceData;
        return {
          title: 'Invoice Rejected',
          message: `Your invoice for ticket "${invoiceData.ticketTitle}" has been rejected.`,
          actionUrl: `/dashboard/contractor/maintenance/tickets/${invoiceData.ticketId}`,
        };
      }

      // ========== VISIT REQUESTS ==========
      case NotificationType.VISIT_NEW_REQUEST: {
        const visitData = data as VisitNewRequestData;
        const visitDateStr = new Date(visitData.visitDate).toLocaleDateString();
        return {
          title: 'New Visit Request',
          message: `${visitData.requesterName} has requested a visit on ${visitDateStr} (${visitData.startTime} - ${visitData.endTime})`,
          actionUrl: `/dashboard/tenant/visit-requests/${visitData.visitRequestId}`,
        };
      }

      case NotificationType.VISIT_APPROVED: {
        const visitData = data as VisitResponseData;
        const visitDateStr = new Date(visitData.visitDate).toLocaleDateString();
        return {
          title: 'Visit Request Approved',
          message: `${visitData.responderName} has approved your visit request for ${visitDateStr}.`,
          actionUrl: `/dashboard/contractor/visit-requests/${visitData.visitRequestId}`,
        };
      }

      case NotificationType.VISIT_DECLINED: {
        const visitData = data as VisitResponseData;
        const visitDateStr = new Date(visitData.visitDate).toLocaleDateString();
        return {
          title: 'Visit Request Declined',
          message: `${visitData.responderName} has declined your visit request for ${visitDateStr}.`,
          actionUrl: `/dashboard/contractor/visit-requests/${visitData.visitRequestId}`,
        };
      }

      case NotificationType.VISIT_RESCHEDULED: {
        const visitData = data as VisitRescheduledData;
        const visitDateStr = new Date(visitData.newVisitDate).toLocaleDateString();
        const message = visitData.rescheduleReason
          ? `${visitData.suggesterName} suggested a new time: ${visitDateStr} (${visitData.newStartTime} - ${visitData.newEndTime}). Reason: ${visitData.rescheduleReason}`
          : `${visitData.suggesterName} suggested a new time: ${visitDateStr} (${visitData.newStartTime} - ${visitData.newEndTime})`;
        return {
          title: 'New Time Suggested',
          message,
          actionUrl: `/dashboard/tenant/visit-requests/${visitData.visitRequestId}`,
        };
      }

      case NotificationType.VISIT_REMINDER: {
        const visitData = data as VisitReminderData;
        const visitDateStr = new Date(visitData.visitDate).toLocaleDateString();
        return {
          title: 'Visit Reminder',
          message: `Reminder: You have a scheduled visit on ${visitDateStr} (${visitData.startTime} - ${visitData.endTime}).`,
          actionUrl: `/dashboard/tenant/visit-requests/${visitData.visitRequestId}`,
        };
      }

      // ========== MESSAGES ==========
      case NotificationType.MESSAGE_NEW_DIRECT: {
        const messageData = data as MessageNewDirectData;
        return {
          title: 'New Message',
          message: `${messageData.senderName} sent you a message`,
          actionUrl: `/dashboard/tenant/chat`,
        };
      }

      case NotificationType.MESSAGE_NEW_GROUP: {
        const messageData = data as MessageNewGroupData;
        return {
          title: 'New Group Message',
          message: `${messageData.senderName} posted in ${messageData.groupName}`,
          actionUrl: `/dashboard/tenant/chat`,
        };
      }

      case NotificationType.MESSAGE_GROUP_INVITE: {
        const messageData = data as MessageGroupInviteData;
        return {
          title: 'Group Chat Invite',
          message: `${messageData.inviterName} invited you to join ${messageData.groupName}`,
          actionUrl: `/dashboard/tenant/chat`,
        };
      }

      // ========== FEED/COMMUNITY ==========
      case NotificationType.FEED_NEW_POST: {
        const feedData = data as FeedNewPostData;
        return {
          title: 'New Community Post',
          message: `New post in ${feedData.propertyName}: "${feedData.postTitle}"`,
          actionUrl: `/dashboard/tenant/feed`,
        };
      }

      case NotificationType.FEED_NEW_ANNOUNCEMENT: {
        const feedData = data as FeedNewAnnouncementData;
        return {
          title: 'New Announcement',
          message: `📢 New announcement for ${feedData.propertyName}: "${feedData.announcementTitle}"`,
          actionUrl: `/dashboard/tenant/feed`,
        };
      }

      case NotificationType.FEED_POST_REACTION: {
        const feedData = data as FeedPostReactionData;
        return {
          title: 'Post Reaction',
          message: `${feedData.reactorName} reacted to your post "${feedData.postTitle}"`,
          actionUrl: `/dashboard/tenant/feed`,
        };
      }

      default:
        return {
          title: 'Notification',
          message: `You have a new notification.`,
        };
    }
  }

  private getSmsContentByType(
    notificationType: NotificationType,
    data: BaseNotificationData,
  ): SmsContent | null {
    switch (notificationType) {
      // ========== LEASE ==========
      case NotificationType.LEASE_ACTIVATED: {
        const leaseData = data as LeaseActivatedData;
        return {
          message: `Hi ${leaseData.recipientName}, your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has been activated. Welcome to your new home!`,
        };
      }

      case NotificationType.LEASE_TERMINATED: {
        const leaseData = data as LeaseTerminatedData;
        const moveOutDateStr = new Date(leaseData.moveOutDate).toLocaleDateString();
        return {
          message: `Hi ${leaseData.recipientName}, your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has been terminated. Move-out date: ${moveOutDateStr}. Please check your email for details.`,
        };
      }

      case NotificationType.LEASE_RENEWAL_REMINDER: {
        const leaseData = data as LeaseRenewalReminderData;
        const newEndDateStr = new Date(leaseData.newLeaseEndDate).toLocaleDateString();
        return {
          message: `Hi ${leaseData.recipientName}, your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has been renewed. New end date: ${newEndDateStr}. Check your email for updated terms.`,
        };
      }

      case NotificationType.LEASE_EXPIRING_SOON: {
        const leaseData = data as LeaseExpiringSoonData;
        const message =
          leaseData.daysRemaining > 0
            ? `Hi ${leaseData.recipientName}, your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} expires in ${leaseData.daysRemaining} days. Please contact us to discuss renewal options.`
            : `Hi ${leaseData.recipientName}, your lease for ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} has expired. Please contact us to discuss renewal options.`;
        return { message };
      }

      case NotificationType.LEASE_TERMS_UPDATED: {
        const leaseData = data as LeaseTermsUpdatedData;
        return {
          message: `Hi ${leaseData.recipientName}, the terms for your lease at ${leaseData.propertyName} - Unit ${leaseData.unitIdentifier} have been updated. Please check your email for details.`,
        };
      }

      // ========== MAINTENANCE ==========
      case NotificationType.MAINTENANCE_NEW_REQUEST: {
        const maintenanceData = data as MaintenanceNewRequestData;
        return {
          message: `Hi ${maintenanceData.recipientName}, a new maintenance request "${maintenanceData.ticketTitle}" has been submitted for ${maintenanceData.propertyName}${maintenanceData.unitIdentifier ? ` - Unit ${maintenanceData.unitIdentifier}` : ''}.`,
        };
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_IN_PROGRESS:
      case NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED:
      case NotificationType.MAINTENANCE_STATUS_CHANGED_CLOSED: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        return {
          message: `Hi ${maintenanceData.recipientName}, maintenance ticket #${maintenanceData.ticketNumber} at ${maintenanceData.propertyName} is now ${maintenanceData.status}.`,
        };
      }

      case NotificationType.MAINTENANCE_ASSIGNED_TO_CONTRACTOR: {
        const maintenanceData = data as MaintenanceAssignedToContractorData;
        return {
          message: `Hi ${maintenanceData.recipientName}, your maintenance request "${maintenanceData.ticketTitle}" has been assigned to ${maintenanceData.contractorName}.`,
        };
      }

      // ========== VISIT REQUESTS ==========
      case NotificationType.VISIT_REMINDER: {
        const visitData = data as VisitReminderData;
        const visitDateStr = new Date(visitData.visitDate).toLocaleDateString();
        return {
          message: `Hi ${visitData.recipientName}, reminder: you have a scheduled visit on ${visitDateStr} (${visitData.startTime} - ${visitData.endTime}).`,
        };
      }

      // For other notification types, SMS is not supported by default
      default:
        return null;
    }
  }

  private getEmailContentByType(
    notificationType: NotificationType,
    data: BaseNotificationData,
  ): EmailContent | null {
    switch (notificationType) {
      // ========== LEASE ==========
      case NotificationType.LEASE_ACTIVATED: {
        const leaseData = data as LeaseActivatedData;
        return {
          templateName: 'lease-activated',
          templateData: {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail,
            isTenant: leaseData.isTenant,
            propertyName: leaseData.propertyName,
            unitIdentifier: leaseData.unitIdentifier,
            propertyAddress: leaseData.propertyAddress,
            leaseStartDate: leaseData.leaseStartDate,
            leaseEndDate: leaseData.leaseEndDate,
            monthlyRent: leaseData.monthlyRent,
          },
        };
      }

      case NotificationType.LEASE_TERMINATED: {
        const leaseData = data as LeaseTerminatedData;
        return {
          templateName: 'lease-termination',
          templateData: {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail,
            isTenant: leaseData.isTenant,
            propertyName: leaseData.propertyName,
            unitIdentifier: leaseData.unitIdentifier,
            propertyAddress: leaseData.propertyAddress,
            originalLeaseEndDate: leaseData.originalLeaseEndDate,
            terminationDate: leaseData.terminationDate,
            terminationReason: leaseData.terminationReason,
            moveOutDate: leaseData.moveOutDate,
            additionalNotes: leaseData.additionalNotes,
          },
        };
      }

      case NotificationType.LEASE_RENEWAL_REMINDER: {
        const leaseData = data as LeaseRenewalReminderData;
        return {
          templateName: 'lease-renewal',
          templateData: {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail,
            isAutoRenewal: leaseData.isAutoRenewal,
            propertyName: leaseData.propertyName,
            unitIdentifier: leaseData.unitIdentifier,
            currentLeaseEndDate: leaseData.currentLeaseEndDate,
            newLeaseStartDate: leaseData.newLeaseStartDate,
            newLeaseEndDate: leaseData.newLeaseEndDate,
            currentMonthlyRent: leaseData.currentMonthlyRent,
            newMonthlyRent: leaseData.newMonthlyRent,
            renewalDate: leaseData.renewalDate,
          },
        };
      }

      case NotificationType.LEASE_EXPIRING_SOON: {
        const leaseData = data as LeaseExpiringSoonData;
        return {
          templateName: 'lease-expiration-warning',
          templateData: {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail,
            isTenant: leaseData.isTenant,
            propertyName: leaseData.propertyName,
            unitIdentifier: leaseData.unitIdentifier,
            propertyAddress: leaseData.propertyAddress,
            leaseStartDate: leaseData.leaseStartDate,
            leaseEndDate: leaseData.leaseEndDate,
            daysRemaining: leaseData.daysRemaining,
          },
        };
      }

      // ========== MAINTENANCE ==========
      case NotificationType.MAINTENANCE_NEW_REQUEST: {
        const maintenanceData = data as MaintenanceNewRequestData;
        return {
          templateName: 'ticket-created',
          templateData: {
            recipientName: maintenanceData.recipientName,
            recipientEmail: maintenanceData.recipientEmail,
            tenantName: maintenanceData.tenantName,
            ticketNumber: maintenanceData.ticketNumber,
            ticketTitle: maintenanceData.ticketTitle,
            priority: maintenanceData.priority,
            category: maintenanceData.category,
            propertyName: maintenanceData.propertyName,
            unitIdentifier: maintenanceData.unitIdentifier,
            description: maintenanceData.description,
            createdAt: maintenanceData.createdAt,
          },
        };
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        return {
          templateName: 'ticket-completed',
          templateData: {
            recipientName: maintenanceData.recipientName,
            recipientEmail: maintenanceData.recipientEmail,
            ticketNumber: maintenanceData.ticketNumber,
            ticketTitle: maintenanceData.ticketTitle,
            propertyName: maintenanceData.propertyName,
            unitIdentifier: maintenanceData.unitIdentifier,
            changedBy: maintenanceData.changedBy,
          },
        };
      }

      case NotificationType.MAINTENANCE_INVOICE_UPLOADED: {
        const invoiceData = data as MaintenanceInvoiceData;
        return {
          templateName: 'invoice-uploaded',
          templateData: {
            recipientName: invoiceData.recipientName,
            recipientEmail: invoiceData.recipientEmail,
            contractorName: invoiceData.contractorName,
            entityReference: invoiceData.ticketNumber,
            invoiceNumber: invoiceData.invoiceNumber,
            amount: invoiceData.amount,
            uploadedAt: new Date(),
          },
        };
      }

      // For other notification types, email is not supported by default
      default:
        return null;
    }
  }
}

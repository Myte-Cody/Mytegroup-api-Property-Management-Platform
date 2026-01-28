import { NotificationType } from '@shared/notification-types';

/**
 * Common fields shared across all notification types
 */
export interface BaseNotificationData {
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  propertyName?: string;
  unitIdentifier?: string;
}

// ============================================================================
// LEASE NOTIFICATION DATA
// ============================================================================

export interface LeaseActivatedData extends BaseNotificationData {
  isTenant: boolean;
  propertyAddress: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  monthlyRent: number;
}

export interface LeaseTerminatedData extends BaseNotificationData {
  isTenant: boolean;
  propertyAddress: string;
  originalLeaseEndDate: Date;
  terminationDate: Date;
  terminationReason: string;
  moveOutDate: Date;
  additionalNotes?: string;
}

export interface LeaseRenewalReminderData extends BaseNotificationData {
  isAutoRenewal: boolean;
  currentLeaseEndDate: Date;
  newLeaseStartDate: Date;
  newLeaseEndDate: Date;
  currentMonthlyRent: number;
  newMonthlyRent?: number;
  renewalDate?: Date;
}

export interface LeaseExpiringSoonData extends BaseNotificationData {
  isTenant: boolean;
  propertyAddress: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  daysRemaining: number;
}

export interface LeaseTermsUpdatedData extends BaseNotificationData {
  isTenant: boolean;
  changedFields?: string[];
}

// ============================================================================
// MAINTENANCE NOTIFICATION DATA
// ============================================================================

export interface MaintenanceNewRequestData extends BaseNotificationData {
  tenantName: string;
  ticketNumber: string;
  ticketTitle: string;
  ticketId: string;
  priority: string;
  category: string;
  description?: string;
  createdAt: Date;
}

export interface MaintenanceStatusChangedData extends BaseNotificationData {
  ticketNumber: string;
  ticketTitle: string;
  ticketId: string;
  status: string;
  previousStatus?: string;
  changedBy?: string;
}

export interface MaintenanceAssignedToContractorData extends BaseNotificationData {
  ticketNumber: string;
  ticketTitle: string;
  ticketId: string;
  contractorName: string;
}

export interface MaintenanceInvoiceData extends BaseNotificationData {
  ticketNumber: string;
  ticketTitle: string;
  ticketId: string;
  contractorName: string;
  invoiceNumber?: string;
  amount?: number;
  rejectionReason?: string;
}

// ============================================================================
// VISIT REQUEST NOTIFICATION DATA
// ============================================================================

export interface VisitNewRequestData extends BaseNotificationData {
  requesterName: string;
  visitDate: Date;
  startTime: string;
  endTime: string;
  visitRequestId: string;
}

export interface VisitResponseData extends BaseNotificationData {
  responderName: string;
  visitDate: Date;
  isApproved: boolean;
  responseMessage?: string;
  visitRequestId: string;
}

export interface VisitRescheduledData extends BaseNotificationData {
  suggesterName: string;
  newVisitDate: Date;
  newStartTime: string;
  newEndTime: string;
  rescheduleReason?: string;
  visitRequestId: string;
}

export interface VisitReminderData extends BaseNotificationData {
  visitDate: Date;
  startTime: string;
  endTime: string;
  visitRequestId: string;
}

// ============================================================================
// MESSAGE NOTIFICATION DATA
// ============================================================================

export interface MessageNewDirectData extends BaseNotificationData {
  senderName: string;
  messagePreview?: string;
  threadId: string;
}

export interface MessageNewGroupData extends BaseNotificationData {
  senderName: string;
  groupName: string;
  messagePreview?: string;
  threadId: string;
}

export interface MessageGroupInviteData extends BaseNotificationData {
  inviterName: string;
  groupName: string;
  threadId: string;
}

// ============================================================================
// FEED/COMMUNITY NOTIFICATION DATA
// ============================================================================

export interface FeedNewPostData extends BaseNotificationData {
  postTitle: string;
  postId: string;
  authorName?: string;
}

export interface FeedNewAnnouncementData extends BaseNotificationData {
  announcementTitle: string;
  postId: string;
}

export interface FeedPostReactionData extends BaseNotificationData {
  reactorName: string;
  postTitle: string;
  postId: string;
  reactionType: string;
}

// ============================================================================
// TYPE MAPPING
// ============================================================================

/**
 * Maps NotificationType to its corresponding data interface
 */
export type NotificationDataMap = {
  // Lease
  [NotificationType.LEASE_ACTIVATED]: LeaseActivatedData;
  [NotificationType.LEASE_TERMINATED]: LeaseTerminatedData;
  [NotificationType.LEASE_RENEWAL_REMINDER]: LeaseRenewalReminderData;
  [NotificationType.LEASE_EXPIRING_SOON]: LeaseExpiringSoonData;
  [NotificationType.LEASE_TERMS_UPDATED]: LeaseTermsUpdatedData;

  // Maintenance
  [NotificationType.MAINTENANCE_NEW_REQUEST]: MaintenanceNewRequestData;
  [NotificationType.MAINTENANCE_STATUS_CHANGED_PENDING]: MaintenanceStatusChangedData;
  [NotificationType.MAINTENANCE_STATUS_CHANGED_IN_PROGRESS]: MaintenanceStatusChangedData;
  [NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED]: MaintenanceStatusChangedData;
  [NotificationType.MAINTENANCE_STATUS_CHANGED_CLOSED]: MaintenanceStatusChangedData;
  [NotificationType.MAINTENANCE_ASSIGNED_TO_CONTRACTOR]: MaintenanceAssignedToContractorData;
  [NotificationType.MAINTENANCE_INVOICE_UPLOADED]: MaintenanceInvoiceData;
  [NotificationType.MAINTENANCE_INVOICE_APPROVED]: MaintenanceInvoiceData;
  [NotificationType.MAINTENANCE_INVOICE_REJECTED]: MaintenanceInvoiceData;

  // Visit Requests
  [NotificationType.VISIT_NEW_REQUEST]: VisitNewRequestData;
  [NotificationType.VISIT_APPROVED]: VisitResponseData;
  [NotificationType.VISIT_DECLINED]: VisitResponseData;
  [NotificationType.VISIT_RESCHEDULED]: VisitRescheduledData;
  [NotificationType.VISIT_REMINDER]: VisitReminderData;

  // Messages
  [NotificationType.MESSAGE_NEW_DIRECT]: MessageNewDirectData;
  [NotificationType.MESSAGE_NEW_GROUP]: MessageNewGroupData;
  [NotificationType.MESSAGE_GROUP_INVITE]: MessageGroupInviteData;

  // Feed/Community
  [NotificationType.FEED_NEW_POST]: FeedNewPostData;
  [NotificationType.FEED_NEW_ANNOUNCEMENT]: FeedNewAnnouncementData;
  [NotificationType.FEED_POST_REACTION]: FeedPostReactionData;
};

// ============================================================================
// UNIFIED REQUEST/RESULT INTERFACES
// ============================================================================

/**
 * Unified request for sending notifications across all channels
 */
export interface NotifyUserRequest<T extends NotificationType = NotificationType> {
  userId: string;
  notificationType: T;
  data: T extends keyof NotificationDataMap ? NotificationDataMap[T] : BaseNotificationData;
  actionUrl?: string;
}

/**
 * Result of the unified notification operation
 */
export interface NotifyUserResult {
  success: boolean;
  channels: {
    inApp: ChannelResult;
    email: ChannelResult;
    sms: ChannelResult;
  };
}

export interface ChannelResult {
  enabled: boolean;
  sent: boolean;
  error?: string;
}

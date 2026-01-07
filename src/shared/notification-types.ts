export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum NotificationCategory {
  MAINTENANCE = 'maintenance',
  LEASE = 'lease',
  MESSAGES = 'messages',
  VISIT_REQUESTS = 'visit_requests',
  MARKETPLACE = 'marketplace',
  COMMUNITY_FEED = 'community_feed',
  INVITATIONS = 'invitations',
  PAYMENTS = 'payments',
  TASKS = 'tasks',
}

export enum UserType {
  LANDLORD = 'Landlord',
  TENANT = 'Tenant',
  CONTRACTOR = 'Contractor',
  ADMIN = 'Admin',
}

export enum NotificationType {
  // Maintenance
  MAINTENANCE_NEW_REQUEST = 'maintenance_new_request',
  MAINTENANCE_STATUS_CHANGED_PENDING = 'maintenance_status_changed_pending',
  MAINTENANCE_STATUS_CHANGED_IN_PROGRESS = 'maintenance_status_changed_in_progress',
  MAINTENANCE_STATUS_CHANGED_COMPLETED = 'maintenance_status_changed_completed',
  MAINTENANCE_STATUS_CHANGED_CLOSED = 'maintenance_status_changed_closed',
  MAINTENANCE_ASSIGNED_TO_CONTRACTOR = 'maintenance_assigned_to_contractor',
  MAINTENANCE_INVOICE_UPLOADED = 'maintenance_invoice_uploaded',
  MAINTENANCE_INVOICE_APPROVED = 'maintenance_invoice_approved',
  MAINTENANCE_INVOICE_REJECTED = 'maintenance_invoice_rejected',

  // Lease
  LEASE_ACTIVATED = 'lease_activated',
  LEASE_TERMINATED = 'lease_terminated',
  LEASE_RENEWAL_REMINDER = 'lease_renewal_reminder',
  LEASE_EXPIRING_SOON = 'lease_expiring_soon',
  LEASE_TERMS_UPDATED = 'lease_terms_updated',

  // Messages
  MESSAGE_NEW_DIRECT = 'message_new_direct',
  MESSAGE_NEW_GROUP = 'message_new_group',
  MESSAGE_GROUP_INVITE = 'message_group_invite',

  // Visit Requests
  VISIT_NEW_REQUEST = 'visit_new_request',
  VISIT_APPROVED = 'visit_approved',
  VISIT_DECLINED = 'visit_declined',
  VISIT_RESCHEDULED = 'visit_rescheduled',
  VISIT_REMINDER = 'visit_reminder',

  // Marketplace
  MARKETPLACE_NEW_INQUIRY = 'marketplace_new_inquiry',
  MARKETPLACE_BOOKING_REQUEST = 'marketplace_booking_request',

  // Community Feed
  FEED_NEW_POST = 'feed_new_post',
  FEED_NEW_ANNOUNCEMENT = 'feed_new_announcement',
  FEED_POST_REACTION = 'feed_post_reaction',

  // Invitations
  INVITATION_RECEIVED = 'invitation_received',
  INVITATION_ACCEPTED = 'invitation_accepted',
  INVITATION_DECLINED = 'invitation_declined',

  // Payments
  PAYMENT_RENT_DUE = 'payment_rent_due',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_OVERDUE = 'payment_overdue',
  PAYMENT_DEPOSIT_REFUNDED = 'payment_deposit_refunded',

  // Tasks
  TASK_CREATED = 'task_created',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_ESCALATED = 'task_escalated',
  TASK_COMPLETED = 'task_completed',
  TASK_CANCELED = 'task_canceled',
}

export interface NotificationTypeMetadata {
  type: NotificationType;
  category: NotificationCategory;
  label: string;
  description: string;
  defaultChannels: {
    [NotificationChannel.IN_APP]: boolean;
    [NotificationChannel.EMAIL]: boolean;
    [NotificationChannel.SMS]: boolean;
  };
  applicableRoles: UserType[];
}

export const NOTIFICATION_TYPE_METADATA: Record<NotificationType, NotificationTypeMetadata> = {
  // Maintenance
  [NotificationType.MAINTENANCE_NEW_REQUEST]: {
    type: NotificationType.MAINTENANCE_NEW_REQUEST,
    category: NotificationCategory.MAINTENANCE,
    label: 'New Maintenance Request',
    description: 'When a new maintenance request is submitted',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MAINTENANCE_STATUS_CHANGED_PENDING]: {
    type: NotificationType.MAINTENANCE_STATUS_CHANGED_PENDING,
    category: NotificationCategory.MAINTENANCE,
    label: 'Request Status: Pending',
    description: 'When a maintenance request status changes to Pending',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MAINTENANCE_STATUS_CHANGED_IN_PROGRESS]: {
    type: NotificationType.MAINTENANCE_STATUS_CHANGED_IN_PROGRESS,
    category: NotificationCategory.MAINTENANCE,
    label: 'Request Status: In Progress',
    description: 'When a maintenance request status changes to In Progress',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED]: {
    type: NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED,
    category: NotificationCategory.MAINTENANCE,
    label: 'Request Status: Completed',
    description: 'When a maintenance request is marked as completed',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MAINTENANCE_STATUS_CHANGED_CLOSED]: {
    type: NotificationType.MAINTENANCE_STATUS_CHANGED_CLOSED,
    category: NotificationCategory.MAINTENANCE,
    label: 'Request Status: Closed',
    description: 'When a maintenance request is closed',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MAINTENANCE_ASSIGNED_TO_CONTRACTOR]: {
    type: NotificationType.MAINTENANCE_ASSIGNED_TO_CONTRACTOR,
    category: NotificationCategory.MAINTENANCE,
    label: 'Assigned to Contractor',
    description: 'When a maintenance request is assigned to a contractor',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.CONTRACTOR, UserType.LANDLORD, UserType.TENANT],
  },
  [NotificationType.MAINTENANCE_INVOICE_UPLOADED]: {
    type: NotificationType.MAINTENANCE_INVOICE_UPLOADED,
    category: NotificationCategory.MAINTENANCE,
    label: 'Invoice Uploaded',
    description: 'When a contractor uploads an invoice for maintenance work',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD],
  },
  [NotificationType.MAINTENANCE_INVOICE_APPROVED]: {
    type: NotificationType.MAINTENANCE_INVOICE_APPROVED,
    category: NotificationCategory.MAINTENANCE,
    label: 'Invoice Approved',
    description: 'When a maintenance invoice is approved',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.CONTRACTOR],
  },
  [NotificationType.MAINTENANCE_INVOICE_REJECTED]: {
    type: NotificationType.MAINTENANCE_INVOICE_REJECTED,
    category: NotificationCategory.MAINTENANCE,
    label: 'Invoice Rejected',
    description: 'When a maintenance invoice is rejected',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.CONTRACTOR],
  },

  // Lease
  [NotificationType.LEASE_ACTIVATED]: {
    type: NotificationType.LEASE_ACTIVATED,
    category: NotificationCategory.LEASE,
    label: 'Lease Activated',
    description: 'When a lease is activated',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.LEASE_TERMINATED]: {
    type: NotificationType.LEASE_TERMINATED,
    category: NotificationCategory.LEASE,
    label: 'Lease Terminated',
    description: 'When a lease is terminated',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.LEASE_RENEWAL_REMINDER]: {
    type: NotificationType.LEASE_RENEWAL_REMINDER,
    category: NotificationCategory.LEASE,
    label: 'Lease Renewal Reminder',
    description: 'Reminder that lease renewal is approaching',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.LEASE_EXPIRING_SOON]: {
    type: NotificationType.LEASE_EXPIRING_SOON,
    category: NotificationCategory.LEASE,
    label: 'Lease Expiring Soon',
    description: 'When a lease is expiring within 30 days',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.LEASE_TERMS_UPDATED]: {
    type: NotificationType.LEASE_TERMS_UPDATED,
    category: NotificationCategory.LEASE,
    label: 'Lease Terms Updated',
    description: 'When lease terms are modified',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },

  // Messages
  [NotificationType.MESSAGE_NEW_DIRECT]: {
    type: NotificationType.MESSAGE_NEW_DIRECT,
    category: NotificationCategory.MESSAGES,
    label: 'New Direct Message',
    description: 'When you receive a new direct message',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: false,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MESSAGE_NEW_GROUP]: {
    type: NotificationType.MESSAGE_NEW_GROUP,
    category: NotificationCategory.MESSAGES,
    label: 'New Group Message',
    description: 'When someone posts in a group chat',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: false,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.MESSAGE_GROUP_INVITE]: {
    type: NotificationType.MESSAGE_GROUP_INVITE,
    category: NotificationCategory.MESSAGES,
    label: 'Group Chat Invite',
    description: 'When you are invited to a group chat',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },

  // Visit Requests
  [NotificationType.VISIT_NEW_REQUEST]: {
    type: NotificationType.VISIT_NEW_REQUEST,
    category: NotificationCategory.VISIT_REQUESTS,
    label: 'New Visit Request',
    description: 'When a new visit request is submitted',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.VISIT_APPROVED]: {
    type: NotificationType.VISIT_APPROVED,
    category: NotificationCategory.VISIT_REQUESTS,
    label: 'Visit Request Approved',
    description: 'When a visit request is approved',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.VISIT_DECLINED]: {
    type: NotificationType.VISIT_DECLINED,
    category: NotificationCategory.VISIT_REQUESTS,
    label: 'Visit Request Declined',
    description: 'When a visit request is declined',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.VISIT_RESCHEDULED]: {
    type: NotificationType.VISIT_RESCHEDULED,
    category: NotificationCategory.VISIT_REQUESTS,
    label: 'Visit Rescheduled',
    description: 'When a visit time is changed',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.VISIT_REMINDER]: {
    type: NotificationType.VISIT_REMINDER,
    category: NotificationCategory.VISIT_REQUESTS,
    label: 'Visit Reminder',
    description: 'Reminder that a scheduled visit is coming up',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: true,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD, UserType.CONTRACTOR],
  },

  // Marketplace
  [NotificationType.MARKETPLACE_NEW_INQUIRY]: {
    type: NotificationType.MARKETPLACE_NEW_INQUIRY,
    category: NotificationCategory.MARKETPLACE,
    label: 'New Property Inquiry',
    description: 'When someone inquires about a property',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD],
  },
  [NotificationType.MARKETPLACE_BOOKING_REQUEST]: {
    type: NotificationType.MARKETPLACE_BOOKING_REQUEST,
    category: NotificationCategory.MARKETPLACE,
    label: 'Booking Request',
    description: 'When a booking request is submitted',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD],
  },

  // Community Feed
  [NotificationType.FEED_NEW_POST]: {
    type: NotificationType.FEED_NEW_POST,
    category: NotificationCategory.COMMUNITY_FEED,
    label: 'New Community Post',
    description: 'When a new post is added to the community feed',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: false,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT],
  },
  [NotificationType.FEED_NEW_ANNOUNCEMENT]: {
    type: NotificationType.FEED_NEW_ANNOUNCEMENT,
    category: NotificationCategory.COMMUNITY_FEED,
    label: 'New Announcement',
    description: 'When an important announcement is posted',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT],
  },
  [NotificationType.FEED_POST_REACTION]: {
    type: NotificationType.FEED_POST_REACTION,
    category: NotificationCategory.COMMUNITY_FEED,
    label: 'Post Reaction',
    description: 'When someone reacts to your post',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: false,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT],
  },

  // Invitations
  [NotificationType.INVITATION_RECEIVED]: {
    type: NotificationType.INVITATION_RECEIVED,
    category: NotificationCategory.INVITATIONS,
    label: 'Invitation Received',
    description: 'When you receive a new invitation',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.INVITATION_ACCEPTED]: {
    type: NotificationType.INVITATION_ACCEPTED,
    category: NotificationCategory.INVITATIONS,
    label: 'Invitation Accepted',
    description: 'When someone accepts your invitation',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.CONTRACTOR],
  },
  [NotificationType.INVITATION_DECLINED]: {
    type: NotificationType.INVITATION_DECLINED,
    category: NotificationCategory.INVITATIONS,
    label: 'Invitation Declined',
    description: 'When someone declines your invitation',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.CONTRACTOR],
  },

  // Payments
  [NotificationType.PAYMENT_RENT_DUE]: {
    type: NotificationType.PAYMENT_RENT_DUE,
    category: NotificationCategory.PAYMENTS,
    label: 'Rent Payment Due',
    description: 'Reminder that rent payment is due',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: true,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.PAYMENT_RECEIVED]: {
    type: NotificationType.PAYMENT_RECEIVED,
    category: NotificationCategory.PAYMENTS,
    label: 'Payment Received',
    description: 'When a payment is successfully received',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.PAYMENT_OVERDUE]: {
    type: NotificationType.PAYMENT_OVERDUE,
    category: NotificationCategory.PAYMENTS,
    label: 'Payment Overdue',
    description: 'When a payment is past its due date',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: true,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },
  [NotificationType.PAYMENT_DEPOSIT_REFUNDED]: {
    type: NotificationType.PAYMENT_DEPOSIT_REFUNDED,
    category: NotificationCategory.PAYMENTS,
    label: 'Security Deposit Refunded',
    description: 'When a security deposit is refunded',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.TENANT, UserType.LANDLORD],
  },

  // Tasks
  [NotificationType.TASK_CREATED]: {
    type: NotificationType.TASK_CREATED,
    category: NotificationCategory.TASKS,
    label: 'New Task Created',
    description: 'When a new task is created',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.TENANT],
  },
  [NotificationType.TASK_STATUS_CHANGED]: {
    type: NotificationType.TASK_STATUS_CHANGED,
    category: NotificationCategory.TASKS,
    label: 'Task Status Changed',
    description: 'When a task status is updated',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.TENANT],
  },
  [NotificationType.TASK_ESCALATED]: {
    type: NotificationType.TASK_ESCALATED,
    category: NotificationCategory.TASKS,
    label: 'Task Escalated',
    description: 'When a task is marked as escalated',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: true,
    },
    applicableRoles: [UserType.LANDLORD, UserType.TENANT],
  },
  [NotificationType.TASK_COMPLETED]: {
    type: NotificationType.TASK_COMPLETED,
    category: NotificationCategory.TASKS,
    label: 'Task Completed',
    description: 'When a task is marked as completed',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: true,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.TENANT],
  },
  [NotificationType.TASK_CANCELED]: {
    type: NotificationType.TASK_CANCELED,
    category: NotificationCategory.TASKS,
    label: 'Task Canceled',
    description: 'When a task is canceled',
    defaultChannels: {
      [NotificationChannel.IN_APP]: true,
      [NotificationChannel.EMAIL]: false,
      [NotificationChannel.SMS]: false,
    },
    applicableRoles: [UserType.LANDLORD, UserType.TENANT],
  },
};

// Helper function to get notification types by category
export function getNotificationTypesByCategory(category: NotificationCategory): NotificationType[] {
  return Object.values(NOTIFICATION_TYPE_METADATA)
    .filter((metadata) => metadata.category === category)
    .map((metadata) => metadata.type);
}

// Helper function to get notification types by role
export function getNotificationTypesByRole(role: UserType): NotificationType[] {
  return Object.values(NOTIFICATION_TYPE_METADATA)
    .filter((metadata) => metadata.applicableRoles.includes(role))
    .map((metadata) => metadata.type);
}

// Helper function to get category label
export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  [NotificationCategory.MAINTENANCE]: 'Maintenance',
  [NotificationCategory.LEASE]: 'Lease Updates',
  [NotificationCategory.MESSAGES]: 'Messages',
  [NotificationCategory.VISIT_REQUESTS]: 'Visit Requests',
  [NotificationCategory.MARKETPLACE]: 'Marketplace',
  [NotificationCategory.COMMUNITY_FEED]: 'Community Feed',
  [NotificationCategory.INVITATIONS]: 'Invitations',
  [NotificationCategory.PAYMENTS]: 'Payments & Transactions',
  [NotificationCategory.TASKS]: 'Tasks',
};

// Helper function to get categories by role
export function getCategoriesByRole(role: UserType): NotificationCategory[] {
  const roleCategories: Record<UserType, NotificationCategory[]> = {
    [UserType.TENANT]: [
      NotificationCategory.MAINTENANCE,
      NotificationCategory.LEASE,
      NotificationCategory.MESSAGES,
      NotificationCategory.VISIT_REQUESTS,
      NotificationCategory.MARKETPLACE,
      NotificationCategory.COMMUNITY_FEED,
      NotificationCategory.TASKS,
    ],
    [UserType.LANDLORD]: [
      NotificationCategory.MAINTENANCE,
      NotificationCategory.LEASE,
      NotificationCategory.MESSAGES,
      NotificationCategory.VISIT_REQUESTS,
      NotificationCategory.MARKETPLACE,
      NotificationCategory.INVITATIONS,
      NotificationCategory.PAYMENTS,
      NotificationCategory.TASKS,
    ],
    [UserType.CONTRACTOR]: [
      NotificationCategory.MAINTENANCE,
      NotificationCategory.VISIT_REQUESTS,
      NotificationCategory.MESSAGES,
      NotificationCategory.INVITATIONS,
    ],
    [UserType.ADMIN]: [],
  };

  return roleCategories[role] || [];
}

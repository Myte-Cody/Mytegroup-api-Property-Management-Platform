export enum TicketCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  HVAC = 'HVAC',
  APPLIANCES = 'APPLIANCES',
  STRUCTURAL = 'STRUCTURAL',
  PAINTING = 'PAINTING',
  CLEANING = 'CLEANING',
  PEST_CONTROL = 'PEST_CONTROL',
  SECURITY = 'SECURITY',
  GENERAL = 'GENERAL',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  URGENT = 'URGENT', // Emergency (24hrs)
  HIGH = 'HIGH', // Important (2-3 days)
  MEDIUM = 'MEDIUM', // Standard (1 week)
  LOW = 'LOW', // Non-critical (when convenient)
}

export enum TicketStatus {
  OPEN = 'OPEN', // Newly created
  IN_REVIEW = 'IN_REVIEW', // Landlord reviewing
  ASSIGNED = 'ASSIGNED', // Contractor assigned
  IN_PROGRESS = 'IN_PROGRESS', // Work started
  DONE = 'DONE', // Work finished
  CLOSED = 'CLOSED', // Ticket resolved
}

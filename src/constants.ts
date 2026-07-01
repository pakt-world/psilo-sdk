export const COLLECTION_EVENTS = {
  CREATED: "collection_created",
  UPDATED: "collection_updated",
  DELETED: "collection_deleted",
} as const;

export const COLLECTION_TYPE_EVENTS = {
  CREATED: "collection_type_created",
  UPDATED: "collection_type_updated",
  DELETED: "collection_type_deleted",
} as const;

export const PAYMENT_EVENTS = {
  REQUESTED: "payment_requested",
  VALIDATED: "payment_validated",
  RELEASED_REQUESTED: "payment_released_requested",
  RELEASED_COMPLETED: "payment_released_completed",
} as const;

export const WALLET_EVENTS = {
  GENERATE: "wallet_generate",
  FETCH_BALANCE: "fetch_balance",
} as const;

export const EMAIL_EVENTS = {
  SEND: "send_email",
} as const;

export const JOB_EVENTS = {
  CREATED: "job_created",
  INVITE_SENT: "job_invite_sent",
  INVITE_ACCEPTED: "job_invite_accepted",
  INVITE_DECLINED: "job_invite_declined",
  INVITE_CANCELLED: "job_invite_cancelled",
  APPLIED: "job_applied",
  APPLICATION_ACCEPTED: "job_application_accepted",
  APPLICATION_REJECTED: "job_application_rejected",
  APPLICATION_WITHDRAWN: "job_application_withdrawn",
  CANCEL_REQUESTED: "job_cancel_requested",
  CANCEL_ACCEPTED: "job_cancel_accepted",
  CANCEL_DECLINED: "job_cancel_declined",
  REVIEW_CHANGE_REQUESTED: "job_review_change_requested",
  REVIEW_CHANGE_ACCEPTED: "job_review_change_accepted",
  REVIEW_CHANGE_DECLINED: "job_review_change_declined",
  COMPLETED: "job_completed",
  PAYMENT_RELEASED: "job_payment_released",
  REVIEWED: "job_reviewed",
  DELIVERABLE_COMPLETED: "job_deliverable_completed",
} as const;

export const FEED_TYPES = {
  JOB_CREATED: "job_created",
  JOB_INVITE: "job_invite",
  JOB_INVITE_ACCEPTED: "job_invitation_accepted",
  JOB_INVITE_DECLINED: "job_invitation_declined",
  JOB_INVITE_CANCELLED: "job_invite_cancelled",
  JOB_APPLIED: "job_application_submitted",
  JOB_APPLICATION_ACCEPTED: "job_application_accepted",
  JOB_APPLICATION_REJECTED: "job_application_rejected",
  JOB_DELIVERABLE_UPDATE: "job_deliverable_update",
  JOB_REVIEW: "job_review",
  JOB_PAYMENT_RELEASED: "job_payment_released",
} as const;

/** Reservation DTOs — guest-facing table booking flow. */

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "checked_in"
  | "completed"
  | "no_show";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  checked_in: "Seated",
  completed: "Completed",
  no_show: "No-Show",
};

export interface CreateReservationInput {
  name: string;
  email: string;
  phone?: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h) */
  time: string;
  partySize: number;
  seatingPreference?: string;
  notes?: string;
}

export interface ReservationDto {
  _id: string;
  reservationNumber: string;
  managementToken?: string;
  kind?: "reservation" | "waitlist";
  durationMinutes?: number;
  tableSessionId?: string;
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  partySize: number;
  seatingPreference?: string;
  notes?: string;
  status: ReservationStatus;
  tableId?: string;
  createdAt: string;
  updatedAt: string;
}

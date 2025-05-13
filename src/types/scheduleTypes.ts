
export type CellData = {
  id?: string;
  assigned: boolean;
  locked: boolean;
  requested_off: boolean;
};

export type ShiftRecord = {
  id: string;
  work_period_id: string;
  user_id: string;
  shift_date: string;
  assigned: boolean;
  locked: boolean;
  requested_off: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  isAdmin?: boolean;
};

export type ScheduleGrid = Record<string, Record<string, CellData>>;

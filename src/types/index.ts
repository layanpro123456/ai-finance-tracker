export interface Account {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  balance: number;
  created_at?: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense';
  is_default: boolean;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  raw_prompt?: string;
  transaction_date: string;
  created_at?: string;
  accounts?: { name: string; currency: string };
  categories?: { name: string };
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  month_year: string;
  created_at?: string;
  categories?: { name: string };
}

export interface ParsedTransactionData {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  transaction_date: string;
  raw_prompt: string;
}

export type ParsedTransaction = ParsedTransactionData;

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FinancialTaskType = 'payable' | 'receivable' | 'budget_task' | 'none';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  is_financial: boolean;
  financial_type: FinancialTaskType;
  amount: number;
  category_id?: string | null;
  account_id?: string | null;
  related_transaction_id?: string | null;
  recurrence_rule?: string;
  completed_at?: string | null;
  created_at?: string;
  categories?: { name: string };
  accounts?: { name: string; currency: string };
}

export type AssetCategory = 'Electronics' | 'Vehicles' | 'Real Estate' | 'Home & Tools' | 'Jewelry & Collectibles' | 'Other';
export type AssetStatus = 'active' | 'sold' | 'donated' | 'disposed';

export interface PersonalAsset {
  id: string;
  user_id: string;
  name: string;
  category: AssetCategory;
  purchase_price: number;
  current_value: number;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  serial_number?: string | null;
  location?: string | null;
  notes?: string | null;
  status: AssetStatus;
  linked_transaction_id?: string | null;
  created_at?: string;
}

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  cost: number;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  category_id?: string | null;
  account_id?: string | null;
  is_active: boolean;
  cancellation_url?: string | null;
  notes?: string | null;
  created_at?: string;
  categories?: { name: string };
  accounts?: { name: string; currency: string };
}

export type ContactDebtType = 'they_owe_me' | 'i_owe_them';

export interface ContactsLedger {
  id: string;
  user_id: string;
  contact_name: string;
  type: ContactDebtType;
  amount: number;
  description?: string | null;
  due_date?: string | null;
  is_settled: boolean;
  settled_at?: string | null;
  settled_transaction_id?: string | null;
  created_at?: string;
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  maskedId: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  joinedDate: string;
  lastActive: string;
  totalTransactions: number;
  totalAccounts: number;
  totalTasks: number;
  totalSubscriptions: number;
  aiUsageRate: number; // percentage
}

export type ActivityEventType =
  | 'AUTH'
  | 'TRANSACTION'
  | 'BUDGET'
  | 'TASK'
  | 'ASSET'
  | 'SUBSCRIPTION'
  | 'SOCIAL_IOU'
  | 'SECURITY';

export interface PlatformActivityLog {
  id: string;
  timestamp: string;
  type: ActivityEventType;
  userId: string;
  userEmailMasked: string;
  action: string;
  platform: string;
  status: 'success' | 'warning' | 'info';
}

// ============================================================================
// Location Timeline, Speed-based Mobility & Payment Reminders
// ============================================================================

export type TransportMode =
  | 'stationary'
  | 'walking'
  | 'cycling'
  | 'vehicle'
  | 'high_speed_transit';

export type ReminderType = 'budget' | 'task' | 'contact' | 'custom';

export interface SavedPlace {
  id: string;
  user_id: string;
  device_id?: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  category_id?: string | null;
  linked_task_id?: string | null;
  linked_contact_id?: string | null;
  reminder_type: ReminderType;
  reminder_message?: string | null;
  icon_type?: string;
  created_at?: string;
  // Hydrated join fields (optional)
  categories?: { name: string };
  tasks?: { title: string; amount: number };
  contacts_ledger?: { contact_name: string; amount: number; type: string };
}

export type TimelineEventType = 'trip' | 'stay' | 'payment_alert';

export interface MobilityTimelineEvent {
  id: string;
  user_id: string;
  device_id?: string;
  device_name?: string;
  event_type: TimelineEventType;
  title: string;
  start_time: string;
  end_time?: string | null;
  duration_seconds?: number;
  mode?: TransportMode;
  in_traffic?: boolean;
  distance_km?: number;
  avg_speed_kmh?: number;
  max_speed_kmh?: number;
  estimated_cost?: number;
  is_cost_logged?: boolean;
  place_name?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  is_business_trip?: boolean;
  tax_deduction_amount?: number;
  created_at?: string;
}

export interface DailyMobilityStats {
  id?: string;
  user_id: string;
  device_id?: string;
  stat_date: string; // YYYY-MM-DD
  total_distance_km: number;
  transit_time_minutes: number;
  walking_km: number;
  cycling_km: number;
  vehicle_km: number;
  business_distance_km?: number;
  tax_deduction_accrued?: number;
  estimated_transit_cost: number;
  logged_transit_cost: number;
  top_speed_kmh: number;
  active_stops_count: number;
  created_at?: string;
}

export interface DeviceLocationPing {
  id: string;
  user_id: string;
  device_id: string;
  device_name?: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy_meters?: number | null;
  speed_kmh: number;
  heading?: number | null;
  battery_level?: number | null;
  is_charging?: boolean;
  transport_mode?: TransportMode | 'unknown';
  recorded_at: string;
  created_at?: string;
}

export interface ProximityAlert {
  id: string;
  placeId: string;
  placeName: string;
  distanceMeters: number;
  reminderType: ReminderType;
  reminderMessage: string;
  suggestedActionLabel?: string;
  timestamp: string;
  linkedTaskId?: string | null;
  linkedCategoryId?: string | null;
  linkedContactId?: string | null;
  budgetRemaining?: number | null;
  taskAmount?: number | null;
  contactAmount?: number | null;
}

export interface UserDeviceSession {
  user_id: string;
  active_device_id: string;
  device_name: string;
  platform?: string;
  last_active_at: string;
  created_at?: string;
}

// ============================================================================
// Phase 3: Deep Intelligence & Social ERP Extensions
// ============================================================================

export interface CashFlowForecastEvent {
  name: string;
  amount: number;
  type: 'income' | 'expense';
  source: 'subscription' | 'task' | 'burn_rate' | 'simulated';
}

export interface CashFlowForecastPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. Oct 24
  projectedBalance: number;
  scheduledIncome: number;
  scheduledExpenses: number;
  dailyBurn: number;
  events: CashFlowForecastEvent[];
  isOverdraft: boolean;
}

export interface CashFlowForecastSummary {
  startingBalance: number;
  endingBalance: number;
  minProjectedBalance: number;
  minBalanceDate: string | null;
  isOverdraftRisk: boolean;
  overdraftDate: string | null;
  runwayDays: number | null;
  runwayMonths: number | null;
  dailyAverageBurnRate: number;
  totalScheduledInflow: number;
  totalScheduledOutflow: number;
}

export interface BillParticipant {
  id: string;
  name: string;
  shareAmount: number;
  isUser: boolean;
}

export interface BillSplitSession {
  totalAmount: number;
  description: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: BillParticipant[];
}



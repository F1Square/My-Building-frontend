import { create } from 'zustand';

type BillingCategory = 'maintenance' | 'water_meter' | 'special';

interface PaymentRecord {
  id: string;
  bill_id: string;
  user_id: string;
  amount: number;
  flat_amount?: number;
  status: 'pending' | 'paid' | 'receipt_uploaded' | 'cash_requested';
  paid_at?: string;
  gateway_payment_id?: string;
  razorpay_payment_id?: string;
  receipt_url?: string | null;
  cheque_photo_url?: string | null;
  payment_method?: string | null;
  category?: BillingCategory;
  maintenance_bills?: {
    id: string;
    description: string;
    due_date: string;
    amount: number;
    penalty_amount?: number;
    month?: number;
    year?: number;
    category?: BillingCategory;
  };
  building_payment_method?: string;
  users?: { name?: string; flat_no?: string; wing?: string; email?: string; phone?: string };
}

interface Bill {
  id: string;
  description: string;
  due_date: string;
  amount: number;
  penalty_amount?: number;
  month?: number;
  year?: number;
  category: BillingCategory;
  amount_mode?: 'uniform' | 'flat_wise';
  targeting_mode?: 'building_wide' | 'targeted';
  created_at: string;
  is_edited?: boolean;
  edited_by?: string;
  editor?: { name: string } | null;
}

interface MaintenanceState {
  // Data
  userPayments: PaymentRecord[];
  bills: Bill[];
  billPayments: PaymentRecord[];
  myPramukhPayments: PaymentRecord[];
  
  // Pagination
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  
  // UI State
  activeTab: 'pending' | 'paid';
  pramukhTab: 'bills' | 'my-bill';
  loading: boolean;
  refreshing: boolean;
  
  // Modal States
  detailVisible: boolean;
  selectedRecord: PaymentRecord | null;
  methodModalVisible: boolean;
  methodModalRecord: PaymentRecord | null;
  chequeModalVisible: boolean;
  chequeModalRecord: PaymentRecord | null;
  createVisible: boolean;
  exportVisible: boolean;
  flatDetailVisible: boolean;
  flatDetailRecord: PaymentRecord | null;
  
  // Actions
  setUserPayments: (payments: PaymentRecord[]) => void;
  setBills: (bills: Bill[]) => void;
  setBillPayments: (payments: PaymentRecord[]) => void;
  setMyPramukhPayments: (payments: PaymentRecord[]) => void;
  
  // Pagination Actions
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  resetPagination: () => void;
  
  // UI Actions
  setActiveTab: (tab: 'pending' | 'paid') => void;
  setPramukhTab: (tab: 'bills' | 'my-bill') => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  
  // Modal Actions
  openDetailModal: (record: PaymentRecord) => void;
  closeDetailModal: () => void;
  openMethodModal: (record: PaymentRecord) => void;
  closeMethodModal: () => void;
  openChequeModal: (record: PaymentRecord) => void;
  closeChequeModal: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  openFlatDetailModal: (record: PaymentRecord) => void;
  closeFlatDetailModal: () => void;
  
  // Reset
  reset: () => void;
}

const INITIAL_STATE = {
  userPayments: [],
  bills: [],
  billPayments: [],
  myPramukhPayments: [],
  currentPage: 1,
  pageSize: 20,
  totalPages: 1,
  hasMore: false,
  activeTab: 'pending' as const,
  pramukhTab: 'bills' as const,
  loading: true,
  refreshing: false,
  detailVisible: false,
  selectedRecord: null,
  methodModalVisible: false,
  methodModalRecord: null,
  chequeModalVisible: false,
  chequeModalRecord: null,
  createVisible: false,
  exportVisible: false,
  flatDetailVisible: false,
  flatDetailRecord: null,
};

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  ...INITIAL_STATE,

  // Data setters
  setUserPayments: (payments) => {
    const { currentPage, pageSize } = get();
    const totalPages = Math.ceil(payments.length / pageSize);
    const hasMore = currentPage < totalPages;
    set({ userPayments: payments, totalPages, hasMore });
  },
  
  setBills: (bills) => set({ bills }),
  setBillPayments: (payments) => set({ billPayments: payments }),
  setMyPramukhPayments: (payments) => set({ myPramukhPayments: payments }),

  // Pagination
  setCurrentPage: (page) => {
    const { userPayments, pageSize } = get();
    const totalPages = Math.ceil(userPayments.length / pageSize);
    const hasMore = page < totalPages;
    set({ currentPage: page, hasMore });
  },
  
  nextPage: () => {
    const { currentPage, totalPages } = get();
    if (currentPage < totalPages) {
      set({ currentPage: currentPage + 1, hasMore: currentPage + 1 < totalPages });
    }
  },
  
  prevPage: () => {
    const { currentPage } = get();
    if (currentPage > 1) {
      set({ currentPage: currentPage - 1, hasMore: true });
    }
  },
  
  resetPagination: () => set({ currentPage: 1, totalPages: 1, hasMore: false }),

  // UI Actions
  setActiveTab: (tab) => set({ activeTab: tab, currentPage: 1 }),
  setPramukhTab: (tab) => set({ pramukhTab: tab }),
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),

  // Modal Actions
  openDetailModal: (record) => set({ detailVisible: true, selectedRecord: record }),
  closeDetailModal: () => set({ detailVisible: false, selectedRecord: null }),
  
  openMethodModal: (record) => set({ methodModalVisible: true, methodModalRecord: record }),
  closeMethodModal: () => set({ methodModalVisible: false, methodModalRecord: null }),
  
  openChequeModal: (record) => set({ chequeModalVisible: true, chequeModalRecord: record }),
  closeChequeModal: () => set({ chequeModalVisible: false, chequeModalRecord: null }),
  
  openCreateModal: () => set({ createVisible: true }),
  closeCreateModal: () => set({ createVisible: false }),
  
  openExportModal: () => set({ exportVisible: true }),
  closeExportModal: () => set({ exportVisible: false }),
  
  openFlatDetailModal: (record) => set({ flatDetailVisible: true, flatDetailRecord: record }),
  closeFlatDetailModal: () => set({ flatDetailVisible: false, flatDetailRecord: null }),

  // Reset
  reset: () => set(INITIAL_STATE),
}));

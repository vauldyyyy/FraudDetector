import { create } from 'zustand';
import { DEFAULT_RULES } from '../components/AlertRulesEngine';

const useStore = create((set, get) => ({
  // UI State
  isMobile: window.innerWidth <= 768,
  setIsMobile: (isMobile) => set({ isMobile }),
  view: window.innerWidth <= 768 ? 'user' : 'admin',
  setView: (view) => set({ view }),
  userSubView: 'app',
  setUserSubView: (userSubView) => set({ userSubView }),
  activeTab: 'overview',
  setActiveTab: (activeTab) => set({ activeTab }),

  // Data State
  dataset: [],
  setDataset: (dataset) => set({ dataset }),
  liveTransactions: [],
  setLiveTransactions: (updater) => set((state) => ({ 
    liveTransactions: typeof updater === 'function' ? updater(state.liveTransactions) : updater 
  })),
  selectedTx: null,
  setSelectedTx: (selectedTx) => set({ selectedTx }),
  
  // Monitoring & Alerts
  alertCount: 0,
  setAlertCount: (updater) => set((state) => ({
    alertCount: typeof updater === 'function' ? updater(state.alertCount) : updater
  })),
  isMonitoring: true,
  setIsMonitoring: (isMonitoring) => set({ isMonitoring }),
  filterRisk: 'ALL',
  setFilterRisk: (filterRisk) => set({ filterRisk }),
  alertRules: DEFAULT_RULES,
  setAlertRules: (alertRules) => set({ alertRules }),

  // Logs & Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications]
  })),
  dismissNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  auditLogs: [],
  addAuditLog: (msg, type = 'info') => set((state) => {
    const log = { id: Date.now() + Math.random(), msg, type, time: new Date().toLocaleTimeString() };
    return { auditLogs: [log, ...state.auditLogs].slice(0, 50) };
  }),

  // Modals
  isModalOpen: false,
  setIsModalOpen: (isModalOpen) => set({ isModalOpen }),
  modalTransaction: null,
  setModalTransaction: (modalTransaction) => set({ modalTransaction }),
  isRagOpen: false,
  setIsRagOpen: (isRagOpen) => set({ isRagOpen }),

  // Entities 
  frozenAccounts: new Set(),
  freezeAccount: (accountId) => set((state) => {
    const newSet = new Set(state.frozenAccounts);
    newSet.add(accountId);
    return { frozenAccounts: newSet };
  }),
  otpPending: null,
  setOtpPending: (otpPending) => set({ otpPending }),
}));

export default useStore;

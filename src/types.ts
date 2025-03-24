// Authentication types
export interface EmailOtpRequest {
  email: string;
}

export interface EmailOtpAuthenticate {
  email: string;
  otp: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
  roles: string[];
}

export interface KycStatus {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  type: 'individual' | 'business';
  createdAt: string;
  updatedAt: string;
}

// Wallet types
export interface Wallet {
  id: string;
  name: string;
  address: string;
  network: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WalletBalance {
  walletId: string;
  address: string;
  network: string;
  balance: string;
  usdValue: string;
}

export interface WalletResponse {
  wallets: Wallet[];
}

export interface BalanceResponse {
  balances: WalletBalance[];
}

export interface SetDefaultWalletRequest {
  walletId: string;
}

// Transfer types
export interface TransferData {
  id: string;
  amount: string;
  fee: string;
  total: string;
  fromAddress: string;
  toAddress: string;
  status: 'pending' | 'completed' | 'failed';
  network: string;
  transactionHash?: string;
  createdAt: string;
}

export interface TransferResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface TransferHistoryResponse {
  success: boolean;
  data?: {
    transfers: TransferHistoryItem[];
    pagination: {
      total: number;
      pages: number;
      page: number;
      limit: number;
    };
  };
  error?: string;
}

export interface TransferHistoryItem {
  id: string;
  type: 'send' | 'receive' | 'withdraw';
  amount: string;
  fee: string;
  total: string;
  fromAddress: string;
  toAddress: string;
  toEmail?: string;
  status: 'pending' | 'completed' | 'failed';
  network: string;
  transactionHash?: string;
  createdAt: string;
}

export interface EmailTransferRequest {
  amount: string;
  recipient: string;
  message?: string;
  walletId?: string;
}

export interface WalletWithdrawRequest {
  amount: string;
  address: string;
  network: string;
  walletId?: string;
}

export interface BankWithdrawRequest {
  amount: string;
  accountId: string;
  walletId?: string;
}

// Session management
export interface UserSession {
  token: string;
  refreshToken: string;
  profile: UserProfile;
  chatId: number;
}

// Pusher notifications
export interface PusherAuthRequest {
  socket_id: string;
  channel_name: string;
}

export interface PusherAuthResponse {
  auth: string;
  channel_data?: string;
}

export interface DepositNotification {
  amount: string;
  network: string;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  timestamp: string;
}


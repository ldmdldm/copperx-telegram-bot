/**
 * Type definitions for the application
 */

import TelegramBot from 'node-telegram-bot-api';

/**
 * Session data for user authentication
 */
export interface UserSession {
  userId: number;
  token: string;
  organizationId: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * User profile from Copperx API
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  kycStatus?: string;
  kybStatus?: string;
}

/**
 * Wallet information
 */
export interface Wallet {
  id: string;
  address: string;
  network: string;
  isDefault: boolean;
  balance?: string;
}

/**
 * Transfer information
 */
export interface Transfer {
  id: string;
  amount: string;
  currency: string;
  recipient: string;
  status: string;
  createdAt: string;
  type: 'email' | 'wallet' | 'bank';
}

/**
 * Command handler type
 */
export type CommandHandler = (msg: TelegramBot.Message, match: RegExpExecArray | null) => void;

/**
 * API response containing transfer result
 */
export interface TransferResult {
  id: string;
  amount: string;
  currency: string;
  recipient: string;
  status: string;
  transactionHash?: string;
  fee?: string;
}

/**
 * API response for transfer history request
 */
export interface TransferHistoryResponse {
  data: Transfer[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

/**
 * Generic API response
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

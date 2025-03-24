import axios, { isAxiosError } from 'axios';
import { COPPERX_API_URL } from '../config';
import { getUserSession } from './auth';

// Interface for wallet
export interface Wallet {
  id: string;
  name: string;
  address: string;
  network: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Interface for wallet balance
export interface WalletBalance {
  walletId: string;
  address: string;
  network: string;
  balance: string;  // Using string for precise numeric representation
  isDefault: boolean;
  name: string;
}

/**
 * Get all wallets for the authenticated user
 * @param chatId The Telegram chat ID
 * @returns Promise<Wallet[]>
 */
export async function getWallets(chatId: number): Promise<Wallet[]> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await axios.get(`${COPPERX_API_URL}/wallets`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching wallets:', error);
    if (isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to fetch wallets');
    }
  }
}

/**
 * Get wallet balances for the authenticated user
 * @param chatId The Telegram chat ID
 * @returns Promise<WalletBalance[]>
 */
export async function getWalletBalances(chatId: number): Promise<WalletBalance[]> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await axios.get(`${COPPERX_API_URL}/wallets/balances`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching wallet balances:', error);
    if (isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to fetch wallet balances');
    }
  }
}

/**
 * Set a wallet as the default wallet
 * @param chatId The Telegram chat ID
 * @param walletId The wallet ID to set as default
 * @returns Promise<Wallet>
 */
export async function setDefaultWallet(chatId: number, walletId: string): Promise<Wallet> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await axios.put(
      `${COPPERX_API_URL}/wallets/default`,
      { walletId },
      {
        headers: {
          Authorization: `Bearer ${session.token}`
        }
      }
    );
    
    return response.data;
  } catch (error: unknown) {
    console.error('Error setting default wallet:', error);
    if (isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to set default wallet');
    }
  }
}

/**
 * Get the default wallet
 * @param chatId The Telegram chat ID
 * @returns Promise<Wallet>
 */
export async function getDefaultWallet(chatId: number): Promise<Wallet> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await axios.get(`${COPPERX_API_URL}/wallets/default`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching default wallet:', error);
    if (isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error('Failed to fetch default wallet');
    }
  }
}

/**
 * Format wallet balance for display
 * @param balance The wallet balance object
 * @returns string
 */
export function formatWalletBalance(balance: WalletBalance): string {
  return `${balance.name} (${balance.network}): ${balance.balance} USDC ${balance.isDefault ? '(Default)' : ''}`;
}


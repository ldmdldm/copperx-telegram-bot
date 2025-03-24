import axios from 'axios';
import { logger } from '../utils/logger';
import { COPPERX_API_URL } from '../config';
import { TransferHistoryResponse, TransferHistoryItem, TransferResult } from '../types';

/**
 * Send funds to an email address
 * @param token - User's authentication token
 * @param recipient - Recipient's email
 * @param amount - Amount to send in USDC
 * @param description - Optional transaction description
 * @returns The transfer result
 */
export async function sendFunds(
  token: string,
  recipient: string,
  amount: number,
  description?: string
): Promise<TransferResult> {
  try {
    const response = await axios.post(
      `${COPPERX_API_URL}/transfers/send`,
      {
        recipient,
        amount: amount.toString(),
        description: description || 'Sent via Telegram',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Funds sent successfully', { recipient, amount });
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    logger.error('Error sending funds', {
      error: error.response?.data || error.message,
    });
    return {
      success: false,
      data: { 
        error: error.response?.data?.message || error.message || 'Failed to send funds' 
      },
    };
  }
}

/**
 * Withdraw funds to an external wallet
 * @param token - User's authentication token
 * @param address - Destination wallet address
 * @param amount - Amount to withdraw in USDC
 * @param network - Blockchain network for the withdrawal
 * @returns The transfer result
 */
export async function withdrawToWallet(
  token: string,
  address: string,
  amount: number,
  network: string
): Promise<TransferResult> {
  try {
    const response = await axios.post(
      `${COPPERX_API_URL}/transfers/wallet-withdraw`,
      {
        address,
        amount: amount.toString(),
        network,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Funds withdrawn to wallet successfully', { address, amount, network });
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    logger.error('Error withdrawing funds to wallet', {
      error: error.response?.data || error.message,
    });
    return {
      success: false,
      data: {
        error: error.response?.data?.message || error.message || 'Failed to withdraw funds'
      },
    };
  }
}

/**
 * Withdraw funds to a bank account
 * @param token - User's authentication token
 * @param amount - Amount to withdraw in USDC
 * @param bankId - ID of the connected bank account
 * @returns The transfer result
 */
export async function withdrawToBank(
  token: string,
  amount: number,
  bankId: string
): Promise<TransferResult> {
  try {
    const response = await axios.post(
      `${COPPERX_API_URL}/transfers/offramp`,
      {
        amount: amount.toString(),
        bankId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Funds withdrawn to bank successfully', { bankId, amount });
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    logger.error('Error withdrawing funds to bank', {
      error: error.response?.data || error.message,
    });
    return {
      success: false,
      data: {
        error: error.response?.data?.message || error.message || 'Failed to withdraw funds to bank'
      },
    };
  }
}

/**
 * Get transaction history
 * @param token - User's authentication token
 * @param page - Page number for pagination (default: 1)
 * @param limit - Number of transactions per page (default: 10)
 * @returns List of transactions
 */
export async function getTransactionHistory(
  token: string,
  page: number = 1,
  limit: number = 10
): Promise<TransferHistoryResponse> {
  try {
    const response = await axios.get(
      `${COPPERX_API_URL}/transfers`,
      {
        params: { page, limit },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    logger.info('Transaction history fetched successfully', { page, limit });
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    logger.error('Error fetching transaction history', {
      error: error.response?.data || error.message,
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch transaction history'
    };
  }
}


import { TransferResult, Transfer, ApiResponse } from '../types/index';

/**
 * Utility functions for formatting values
 */

/**
 * Formats an amount value for display with currency symbol and proper decimal places
 * @param amount The amount to format
 * @param currency The currency code (default: 'USDC')
 * @param decimals The number of decimal places to show (default: 2)
 * @returns Formatted amount string
 */
export const formatTransferAmount = (
  amount: number | string, 
  currency: string = 'USDC', 
  decimals: number = 2
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return `0.00 ${currency}`;
  }
  
  return `${numAmount.toFixed(decimals)} ${currency}`;
};

/**
 * Formats a date for display
 * @param date Date to format (Date object or ISO string)
 * @param options Optional formatting options
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
};

/**
 * Truncates text (e.g., for addresses) with ellipsis in the middle
 * @param text The text to truncate
 * @param startChars Number of characters to show at start
 * @param endChars Number of characters to show at end
 * @returns Truncated text
 */
export const truncateMiddle = (
  text: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!text) return '';
  if (text.length <= startChars + endChars) return text;
  
  return `${text.substring(0, startChars)}...${text.substring(text.length - endChars)}`;
};

/**
 * Formats a wallet address for display
 * @param address The wallet address
 * @returns Formatted address
 */
export const formatWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return truncateMiddle(address, 6, 4);
};

/**
 * Formats a currency amount with specified decimal places
 * @param amount - Amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted amount string
 */
export function formatCurrency(amount: number | string, decimals = 2): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toFixed(decimals);
}

/**
 * Formats a transfer result into a readable message
 * @param result - Transfer result object
 * @returns Formatted transfer message
 */
export function formatTransferResult(result: ApiResponse<TransferResult>): string {
  if (!result.success || !result.data) {
    return `❌ Transfer Failed\n${result.error || 'Unknown error'}`;
  }

  const transferData = result.data;
  return `✅ Transfer Successful
  
Amount: ${formatCurrency(transferData.amount)} ${transferData.currency}
Transaction Hash: ${transferData.transactionHash || 'N/A'}
Status: ${transferData.status}
Date: ${formatDate(new Date())}`;
}

/**
 * Formats a transaction history item into a readable message
 * @param transaction - Transaction history item
 * @returns Formatted transaction message
 */
export function formatTransactionHistoryItem(transaction: Transfer): string {
  const direction = transaction.type === 'email' ? '📧 Email Transfer' : 
                   transaction.type === 'wallet' ? '💳 Wallet Transfer' : 
                   '🏦 Bank Transfer';
  const status = getStatusEmoji(transaction.status);
  
  return `${direction} ${status}
Amount: ${formatCurrency(transaction.amount)} ${transaction.currency}
Date: ${formatDate(transaction.createdAt)}
Status: ${transaction.status}
ID: ${transaction.id}`;
}

/**
 * Gets an emoji representation of a transaction status
 * @param status - Transaction status
 * @returns Emoji representation of status
 */
function getStatusEmoji(status: string): string {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return '✅';
    case 'PENDING':
      return '⏳';
    case 'FAILED':
      return '❌';
    default:
      return '❓';
  }
}


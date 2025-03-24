import axios, { isAxiosError } from 'axios';
import { COPPERX_API_URL } from '../config';
import { logger } from '../utils/logger';
import { storeUserSession as redisStoreUserSession, getUserSession as redisGetUserSession, deleteUserSession, hasUserSession } from '../utils/redis';
// Types for authentication responses
export interface AuthToken {
  token: string;
  refreshToken?: string;
  expiresIn: number;
  organizationId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
  role: string;
  kycStatus: string;
  kybStatus: string;
}

// Global variables for temporary storage during authentication process
let authTokens: AuthToken | null = null;
let emailOtpSessions = new Map<string, string>(); // Map email to session ID
// Request email OTP
export async function requestEmailOTP(email: string): Promise<boolean> {
  try {
    const response = await axios.post(`${COPPERX_API_URL}/auth/email-otp/request`, { email });
    
    // Extract and store the session ID (sid) from the response
    if (response.data && response.data.sid) {
      logger.debug(`Received session ID (sid) for email: ${email}`);
      emailOtpSessions.set(email, response.data.sid);
    } else {
      logger.warn(`No session ID (sid) found in OTP request response for email: ${email}`);
    }
    
    return response.status === 200;
  } catch (error: unknown) {
    logger.error('Error requesting email OTP:', error);
    if (isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || error.response.data?.error || 'Failed to request OTP';
      throw new Error(errorMessage);
    }
    throw new Error('Failed to request OTP');
  }
}

// Authenticate using email OTP
export async function authenticateWithOTP(email: string, otp: string): Promise<AuthToken> {
  try {
    // Get the session ID for this email, if it exists
    const sid = emailOtpSessions.get(email);
    
    if (!sid) {
      logger.warn(`No session ID found for ${email}. The OTP request may have failed or expired.`);
    } else {
      logger.debug(`Using session ID (sid) for authentication: ${email}`);
    }
    
    logger.debug(`Attempting to authenticate with OTP for ${email}`, { payload: { email, sid } });
    
    const response = await axios.post(`${COPPERX_API_URL}/auth/email-otp/authenticate`, { 
      email, 
      otp: otp.replace(/\s+/g, ''), // Remove any whitespace from OTP
      sid  // Include the session ID parameter
    });

    // Log successful response details
    logger.debug('Authentication response received', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    if (!response.data || (!response.data.token && !response.data.accessToken)) {
      throw new Error('Invalid response from server');
    }
    
    // Handle new API response structure with accessToken instead of token
    const token = response.data.token || response.data.accessToken;
    const refreshToken = response.data.refreshToken || response.data.refresh_token || ''; // Try alternative refresh token name
    
    // Handle expiration time from either expiresIn or expireAt
    let expiresIn = response.data.expiresIn;
    if (!expiresIn && response.data.expireAt) {
      // If we have expireAt (timestamp), calculate expiresIn (seconds)
      const expireAtTimestamp = new Date(response.data.expireAt).getTime();
      const currentTimestamp = new Date().getTime();
      expiresIn = Math.floor((expireAtTimestamp - currentTimestamp) / 1000); // Convert ms to seconds
      logger.debug('Calculated expiresIn from expireAt:', { 
        expireAt: response.data.expireAt, 
        calculatedExpiresIn: expiresIn 
      });
    }
    
    // Try to extract organizationId from either top level or user object
    let organizationId = response.data.organizationId || '';
    if (!organizationId && response.data.user && response.data.user.organizationId) {
      organizationId = response.data.user.organizationId;
      logger.debug('Extracted organizationId from user object');
    }
    
    if (!token) {
      throw new Error('Missing authentication token in response');
    }
    
    // Log what we found to help with debugging
    logger.debug('Authentication token extracted:', { 
      hasToken: !!token, 
      hasRefreshToken: !!refreshToken,
      tokenSource: response.data.token ? 'token' : 'accessToken',
      refreshTokenSource: response.data.refreshToken ? 'refreshToken' : (response.data.refresh_token ? 'refresh_token' : 'none'),
      expiresIn: expiresIn,
      organizationId: organizationId,
      expireAt: response.data.expireAt || 'not provided',
      hasUserObject: !!response.data.user
    });
    
    // Only include refreshToken in the authTokens if it exists
    authTokens = { 
      token, 
      expiresIn, 
      organizationId,
      ...(refreshToken ? { refreshToken } : {})
    };
    // Clear the session ID after successful authentication
    emailOtpSessions.delete(email);
    return authTokens;
  } catch (error: unknown) {
    logger.error('Error authenticating with OTP:', error);
    if (isAxiosError(error) && error.response) {
      // Log detailed response information
      logger.debug('Authentication error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      });
      logger.debug('Authentication error response data:', JSON.stringify(error.response.data, null, 2));
      
      // Special handling for 422 Unprocessable Entity errors
      if (error.response.status === 422) {
        let errorMessage = 'Validation failed';
        logger.debug(`422 Validation Error: Processing response structure: ${typeof error.response.data}`);
        
        // Try to extract validation errors from the response
        if (error.response.data) {
          if (typeof error.response.data.message === 'string') {
            errorMessage = error.response.data.message;
          } else if (Array.isArray(error.response.data.message)) {
            // Handle case where message is an array
            if (error.response.data.message.length > 0 && typeof error.response.data.message[0] === 'object') {
              // This is likely an array of validation error objects with property and constraints
              try {
                // Extract meaningful information from each validation error object
                const formattedErrors = error.response.data.message.map((errorObj: any) => {
                  // Check if it has property and constraints fields (typical for class-validator errors)
                  if (errorObj.property && errorObj.constraints) {
                    const constraints = Object.values(errorObj.constraints).join(', ');
                    return `${errorObj.property}: ${constraints}`;
                  } 
                  // Handle nested error objects that have children
                  else if (errorObj.property && errorObj.children && Array.isArray(errorObj.children)) {
                    const nestedErrors = errorObj.children.map((child: any) => {
                      if (child.property && child.constraints) {
                        const constraints = Object.values(child.constraints).join(', ');
                        return `${errorObj.property}.${child.property}: ${constraints}`;
                      }
                      return null;
                    }).filter(Boolean).join('; ');
                    
                    return nestedErrors || `Invalid ${errorObj.property}`;
                  }
                  // Fallback to JSON stringifying the object if we can't extract structured info
                  return JSON.stringify(errorObj);
                }).filter(Boolean).join('; ');
                
                errorMessage = formattedErrors || 'Validation failed';
                logger.debug('Formatted validation errors:', errorMessage);
                logger.debug('Original validation error structure:', {
                  structure: JSON.stringify(error.response.data.message),
                  type: Array.isArray(error.response.data.message) ? 'array' : typeof error.response.data.message
                });
              } catch (e) {
                logger.error('Error processing validation error objects:', e);
                // Fallback to simpler joining of raw objects
                errorMessage = error.response.data.message.join(', ');
              }
            } else {
              // Simple array of strings or primitives
              errorMessage = error.response.data.message.join(', ');
            }
          } else if (typeof error.response.data.message === 'object' && error.response.data.message !== null) {
            // Handle case where message is a nested object with validation errors
            try {
              errorMessage = JSON.stringify(error.response.data.message);
              logger.debug('Stringified object error message:', errorMessage);
            } catch (e) {
              logger.error('Error stringifying error message object:', e);
              errorMessage = 'Invalid OTP or validation errors';
            }
          }
          
          // Also check for errors field which might contain validation details
          if (error.response.data.errors && typeof error.response.data.errors === 'object') {
            try {
              const errorDetails = Object.entries(error.response.data.errors)
                .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                .join('; ');
              
              if (errorDetails) {
                errorMessage = errorMessage + ': ' + errorDetails;
              }
            } catch (e) {
              // If we can't parse the errors object, stick with the message we have
            }
          }
        }
        
        // Ensure errorMessage is a string before throwing
        throw new Error(String(errorMessage));
      }
      
      // Handle other error types based on status code
      logger.debug(`Handling error response with status ${error.response.status}`);
      
      // Map status codes to user-friendly messages
      const statusMessages: Record<number, string> = {
        400: 'Bad request - Please check your input',
        401: 'Unauthorized - Invalid credentials',
        403: 'Forbidden - You don\'t have permission to access this resource',
        404: 'Not found - The requested authentication endpoint was not found',
        500: 'Server error - The authentication service is experiencing issues',
        502: 'Bad gateway - The authentication service is currently unavailable',
        503: 'Service unavailable - The authentication service is temporarily down',
        504: 'Gateway timeout - The authentication service timed out'
      };
      
      const baseErrorMessage = statusMessages[error.response.status] || 'Authentication failed';
      const errorMessage = error.response.data?.message || error.response.data?.error || baseErrorMessage;
      
      if (Array.isArray(errorMessage)) {
        throw new Error(errorMessage.join(', '));
      } else if (typeof errorMessage === 'object' && errorMessage !== null) {
        try {
          const stringifiedError = JSON.stringify(errorMessage);
          logger.debug('Stringified error object:', stringifiedError);
          throw new Error(stringifiedError);
        } catch (e) {
          logger.error('Error stringifying error object:', e);
          throw new Error('Authentication failed with validation errors');
        }
      }
      throw new Error(String(errorMessage));
    }
    throw new Error('Authentication failed');
  } finally {
    // If there was an error, we might want to keep the session ID for retries
    // but we'll add a cleanup method just in case
  }
}

// Helper function to clear any stored session IDs if needed
export function clearEmailOtpSession(email: string): void {
  if (emailOtpSessions.has(email)) {
    emailOtpSessions.delete(email);
    logger.debug(`Cleared session ID for email: ${email}`);
  }
}

// Store user session
export async function storeUserSession(chatId: number, tokens: AuthToken): Promise<void> {
  await redisStoreUserSession(chatId, tokens);
}

// Get user session
export async function getUserSession(chatId: number): Promise<AuthToken | null> {
  return await redisGetUserSession(chatId);
}

// Clear user session
export async function clearUserSession(chatId: number): Promise<void> {
  await deleteUserSession(chatId);
}

// Check if user is authenticated
export async function isAuthenticated(chatId: number): Promise<boolean> {
  return await hasUserSession(chatId);
}

// Get current user profile
export async function getUserProfile(chatId: number): Promise<UserProfile> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await axios.get(`${COPPERX_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    
    if (!response.data) {
      throw new Error('Invalid response from server');
    }
    
    return response.data;
  } catch (error: unknown) {
    logger.error('Error fetching user profile:', error);
    if (isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || error.response.data?.error || 'Failed to fetch user profile';
      throw new Error(errorMessage);
    }
    throw new Error('Failed to fetch user profile');
  }
}

// Get KYC status
export async function getKYCStatus(chatId: number): Promise<any> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await axios.get(`${COPPERX_API_URL}/kycs`, {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });
    
    if (!response.data) {
      throw new Error('Invalid response from server');
    }
    
    return response.data;
  } catch (error: unknown) {
    logger.error('Error fetching KYC status:', error);
    if (isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || error.response.data?.error || 'Failed to fetch KYC status';
      throw new Error(errorMessage);
    }
    throw new Error('Failed to fetch KYC status');
  }
}

// Get user token
export async function getUserToken(chatId: number): Promise<string | undefined> {
  const session = await getUserSession(chatId);
  return session ? session.token : undefined;
}

// Refresh authentication token
export async function refreshToken(chatId: number): Promise<AuthToken> {
  const session = await getUserSession(chatId);
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Check if refresh token exists before attempting to refresh
    if (!session.refreshToken) {
      throw new Error('No refresh token available for this session');
    }

    const response = await axios.post(`${COPPERX_API_URL}/auth/refresh`, {
      refreshToken: session.refreshToken
    });
    
    if (!response.data || !response.data.token) {
      throw new Error('Invalid response from server');
    }
    
    const { token, refreshToken, expiresIn, organizationId = session.organizationId || '' } = response.data;
    
    if (!token) {
      throw new Error('Missing authentication token in response');
    }
    
    // Only include refreshToken in newTokens if it exists
    const newTokens = { 
      token, 
      expiresIn, 
      organizationId,
      ...(refreshToken ? { refreshToken } : {})
    };
    await storeUserSession(chatId, newTokens);
    
    return newTokens;
  } catch (error: unknown) {
    logger.error('Error refreshing token:', error);
    await clearUserSession(chatId);
    if (isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || error.response.data?.error || 'Failed to refresh token';
      throw new Error(errorMessage);
    }
    throw new Error('Failed to refresh token');
  }
}


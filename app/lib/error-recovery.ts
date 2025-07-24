/**
 * Error Recovery Service - Handles Firestore version conflicts and other errors gracefully
 * Provides user-friendly error messages and automatic recovery strategies
 */

import { FirebaseError } from 'firebase/app';

export interface RecoveryResult {
  success: boolean;
  message: string;
  userMessage: string;
  shouldRetry: boolean;
  retryDelay?: number;
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;

  public static getInstance(): ErrorRecoveryService {
    if (!this.instance) {
      this.instance = new ErrorRecoveryService();
    }
    return this.instance;
  }

  /**
   * Handle Firestore version conflicts with user-friendly messaging
   */
  public handleVersionConflict(error: FirebaseError, operation: string): RecoveryResult {
    console.warn('⚠️ Firestore version conflict detected:', error.message);
    
    return {
      success: false,
      message: `Version conflict in ${operation}: ${error.message}`,
      userMessage: 'The data was updated by someone else. Please refresh the page and try again.',
      shouldRetry: true,
      retryDelay: 2000
    };
  }

  /**
   * Handle general Firebase errors
   */
  public handleFirebaseError(error: FirebaseError, operation: string): RecoveryResult {
    const { code, message } = error;
    
    switch (code) {
      case 'failed-precondition':
        if (message.includes('stored version') && message.includes('required base version')) {
          return this.handleVersionConflict(error, operation);
        }
        return {
          success: false,
          message: `Precondition failed: ${message}`,
          userMessage: 'Unable to complete the action due to data constraints. Please refresh and try again.',
          shouldRetry: true,
          retryDelay: 3000
        };

      case 'permission-denied':
        return {
          success: false,
          message: `Permission denied: ${message}`,
          userMessage: 'You don\'t have permission to perform this action.',
          shouldRetry: false
        };

      case 'unavailable':
        return {
          success: false,
          message: `Service unavailable: ${message}`,
          userMessage: 'The service is temporarily unavailable. Please try again in a moment.',
          shouldRetry: true,
          retryDelay: 5000
        };

      case 'deadline-exceeded':
        return {
          success: false,
          message: `Operation timed out: ${message}`,
          userMessage: 'The operation took too long. Please try again.',
          shouldRetry: true,
          retryDelay: 3000
        };

      case 'aborted':
        return {
          success: false,
          message: `Operation aborted: ${message}`,
          userMessage: 'The operation was cancelled due to conflicts. Please refresh and try again.',
          shouldRetry: true,
          retryDelay: 2000
        };

      default:
        return {
          success: false,
          message: `Firebase error (${code}): ${message}`,
          userMessage: 'An unexpected error occurred. Please refresh the page and try again.',
          shouldRetry: code !== 'permission-denied',
          retryDelay: 3000
        };
    }
  }

  /**
   * Show user-friendly error notification
   */
  public showErrorToUser(result: RecoveryResult): void {
    // In a real app, this would integrate with your notification system
    console.error('🔥 Firebase Error:', result.message);
    
    // Show user-friendly message
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(result.userMessage);
    }
  }

  /**
   * Auto-retry operation with exponential backoff
   */
  public async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (error instanceof FirebaseError) {
          const result = this.handleFirebaseError(error, 'retry operation');
          
          if (!result.shouldRetry || isLastAttempt) {
            if (isLastAttempt) {
              this.showErrorToUser(result);
            }
            throw error;
          }
          
          // Wait before retrying with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          console.log(`⏳ Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-Firebase error, don't retry
          throw error;
        }
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts`);
  }
}

export const errorRecoveryService = ErrorRecoveryService.getInstance(); 
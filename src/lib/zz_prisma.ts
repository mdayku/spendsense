import { PrismaClient } from "@prisma/client";

// Helper function to retry database operations with exponential backoff
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on connection errors
      const isConnectionError = 
        error.code === 'P1001' || 
        error.message?.includes('Can\'t reach database server') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED');
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.warn(`Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

const g = globalThis as any;

export const prisma =
  g.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;


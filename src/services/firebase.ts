import admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!credentialsPath) {
      console.warn('Firebase credentials not found. OTP will use mock mode.');
      return;
    }

    // Handle both JSON file path and direct JSON content
    let serviceAccount;
    try {
      serviceAccount = require(path.resolve(credentialsPath));
    } catch (error) {
      // If require fails, try reading as JSON string
      const fs = require('fs');
      const fileContent = fs.readFileSync(path.resolve(credentialsPath), 'utf8');
      serviceAccount = JSON.parse(fileContent);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    console.warn('Falling back to mock OTP mode');
  }
};

export const sendOTP = async (phoneNumber: string): Promise<string> => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Use mock OTP mode.');
  }

  try {
    // Firebase Phone Auth - Note: This requires client-side implementation
    // For server-side, we'll use a different approach or mock
    // In production, you'd typically use Firebase Auth REST API or client SDK
    
    // For now, return a session ID that would be used for verification
    // In a real implementation, you'd send OTP via Firebase
    return 'firebase-session-id';
  } catch (error: any) {
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

export const verifyOTP = async (phoneNumber: string, otp: string, sessionId: string): Promise<boolean> => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Use mock OTP mode.');
  }

  try {
    // Verify OTP with Firebase
    // In production, implement actual Firebase verification
    return true;
  } catch (error: any) {
    throw new Error(`Failed to verify OTP: ${error.message}`);
  }
};

export default admin;

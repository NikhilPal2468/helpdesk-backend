import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initializeFirebase } from '../services/firebase';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Firebase on module load
initializeFirebase();

// Generate OTP (Mock or Firebase)
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Valid 10-digit phone number required' });
    }

    const useMock = process.env.MOCK_OTP === 'true';
    
    if (useMock) {
      // Mock OTP - always returns 123456
      return res.json({ 
        success: true, 
        message: 'OTP sent (MOCK mode)',
        otp: '123456' // Only in development
      });
    } else {
      // Firebase Auth implementation
      try {
        const { sendOTP } = await import('../services/firebase');
        const sessionId = await sendOTP(phone);
        
        // In production, Firebase sends OTP via SMS
        // For now, we'll return success (actual OTP sent via Firebase)
        return res.json({
          success: true,
          message: 'OTP sent via Firebase',
          sessionId, // Store this for verification
        });
      } catch (error: any) {
        // Fallback to mock if Firebase fails
        console.error('Firebase OTP error:', error);
        if (error.message?.includes('not initialized')) {
          return res.json({
            success: true,
            message: 'OTP sent (MOCK mode - Firebase not configured)',
            otp: '123456', // Fallback for development
          });
        }
        throw error;
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP and login
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP required' });
    }

    const useMock = process.env.MOCK_OTP === 'true';
    
    if (useMock) {
      // Mock verification - accepts 123456
      if (otp !== '123456') {
        return res.status(401).json({ error: 'Invalid OTP' });
      }
    } else {
      // Firebase verification
      try {
        const { verifyOTP } = await import('../services/firebase');
        // In production, get sessionId from request or session storage
        const sessionId = req.body.sessionId || 'firebase-session-id';
        const isValid = await verifyOTP(phone, otp, sessionId);
        
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid OTP' });
        }
      } catch (error: any) {
        // Fallback to mock verification if Firebase fails
        console.error('Firebase verification error:', error);
        if (error.message?.includes('not initialized')) {
          // Use mock verification
          if (otp !== '123456') {
            return res.status(401).json({ error: 'Invalid OTP' });
          }
        } else {
          return res.status(401).json({ error: 'OTP verification failed' });
        }
      }
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { phone } });
    
    if (!user) {
      user = await prisma.user.create({
        data: { phone }
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createOrder, verifyPayment } from '../services/razorpay';

const router = express.Router();
const prisma = new PrismaClient();

const PAYMENT_AMOUNT = 500; // ₹500 fixed amount

// Create payment order
router.post('/create-order', authenticate, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if payment already exists and is successful
    const existingPayment = await prisma.payment.findUnique({
      where: {
        applicationId: application.id,
      },
    });

    if (existingPayment && existingPayment.status === 'SUCCESS') {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    const order = await createOrder(PAYMENT_AMOUNT);

    // Save payment record (create or update)

    if (existingPayment) {
      await prisma.payment.update({
        where: { applicationId: application.id },
        data: {
          orderId: order.id,
          amount: PAYMENT_AMOUNT,
          status: 'PENDING',
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          applicationId: application.id,
          orderId: order.id,
          amount: PAYMENT_AMOUNT,
          status: 'PENDING',
        },
      });
    }

    res.json({
      success: true,
      orderId: order.id,
      amount: PAYMENT_AMOUNT,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify payment
router.post('/verify', authenticate, async (req: AuthRequest, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const isValid = verifyPayment(orderId, paymentId, signature);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Update payment status (handle case where payment record might not exist)
    let payment;
    const existingPayment = await prisma.payment.findUnique({
      where: { applicationId: application.id },
    });

    if (existingPayment) {
      payment = await prisma.payment.update({
        where: { applicationId: application.id },
        data: {
          paymentId,
          signature,
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      });
    } else {
      // Create payment record if it doesn't exist
      payment = await prisma.payment.create({
        data: {
          applicationId: application.id,
          orderId,
          paymentId,
          signature,
          amount: PAYMENT_AMOUNT,
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: req.userId!,
        title: 'Payment Successful',
        message: 'Your payment of ₹500 has been received successfully.',
        type: 'GENERAL',
      },
    });

    res.json({
      success: true,
      payment,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment status
router.get('/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { userId: req.userId! },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const payment = await prisma.payment.findUnique({
      where: {
        applicationId: application.id,
      },
    });

    res.json({
      payment: payment || null,
      paid: payment?.status === 'SUCCESS',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

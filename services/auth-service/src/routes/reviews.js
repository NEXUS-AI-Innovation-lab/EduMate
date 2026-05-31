const express = require('express');
const axios = require('axios');
const Review = require('../models/Review');
const User = require('../models/User');
const router = express.Router();

const BLOCKCHAIN_BASE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://blockchain-service:3003/api/blockchain';

const getBookingDetails = async (bookingId) => {
  try {
    const response = await axios.get(`${BLOCKCHAIN_BASE_URL}/booking/${bookingId}`, { timeout: 5000 });
    return response.data?.data || null;
  } catch (error) {
    return null;
  }
};

// POST /api/reviews - Créer ou mettre à jour un avis
router.post('/', async (req, res) => {
  try {
    const { bookingId, reviewerId, targetUserId, comment, rating, confidenceRating, reviewerType } = req.body;

    // Validation
    if (!bookingId || !reviewerId || !targetUserId || !comment || !reviewerType) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    if (!['tutor', 'student'].includes(reviewerType)) {
      return res.status(400).json({ error: 'reviewerType invalide' });
    }

    // Vérifier que le reviewer existe
    const reviewer = await User.findByPk(reviewerId);
    if (!reviewer) {
      return res.status(404).json({ error: 'Reviewer non trouvé' });
    }

    // Vérifier que la cible existe
    const target = await User.findByPk(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'Utilisateur évalué non trouvé' });
    }

    // Vérifier que le reviewer n'a pas déjà donné son avis pour ce booking
    const existingReview = await Review.findOne({
      where: {
        bookingId,
        reviewerId
      }
    });

    if (existingReview && existingReview.isConfirmed) {
      return res.status(400).json({ error: 'Vous avez déjà confirmé votre avis, il ne peut pas être modifié' });
    }

    let review;
    if (existingReview) {
      // Mise à jour du draft (avant confirmation)
      await existingReview.update({
        comment,
        rating: rating || existingReview.rating,
        confidenceRating: confidenceRating || existingReview.confidenceRating
      });
      review = existingReview;
    } else {
      // Créer un nouveau avis (en draft)
      review = await Review.create({
        bookingId,
        reviewerId,
        targetUserId,
        comment,
        rating,
        confidenceRating,
        reviewerType,
        isConfirmed: false
      });
    }

    res.json({
      success: true,
      review: review.toJSON()
    });
  } catch (error) {
    console.error('Erreur création review:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reviews/:bookingId/:reviewerId/confirm - Confirmer un avis (irréversible)
router.post('/:bookingId/:reviewerId/confirm', async (req, res) => {
  try {
    const { bookingId, reviewerId } = req.params;

    const review = await Review.findOne({
      where: {
        bookingId,
        reviewerId
      }
    });

    if (!review) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    if (review.isConfirmed) {
      return res.status(400).json({ error: 'Cet avis a déjà été confirmé' });
    }

    // Confirmer l'avis de manière irréversible
    await review.update({
      isConfirmed: true,
      confirmedAt: new Date()
    });

    // Vérifier si les DEUX parties ont confirmé
    const allReviews = await Review.findAll({
      where: { bookingId }
    });

    const allConfirmed = allReviews.length >= 2 && allReviews.every(r => r.isConfirmed);

    res.json({
      success: true,
      review: review.toJSON(),
      allPartiesConfirmed: allConfirmed,
      confirmCount: allReviews.filter(r => r.isConfirmed).length
    });
  } catch (error) {
    console.error('Erreur confirmation review:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reviews/tutor/:tutorUserId - Obtenir les avis d'un tuteur (public)
router.get('/tutor/:tutorUserId', async (req, res) => {
  try {
    const { tutorUserId } = req.params;

    const reviews = await Review.findAll({
      where: {
        targetUserId: tutorUserId,
        reviewerType: 'student',
        isConfirmed: true
      },
      include: [
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order: [['confirmedAt', 'DESC'], ['createdAt', 'DESC']]
    });

    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const booking = await getBookingDetails(review.bookingId);
        const courseTitle = booking?.description || 'Session de tutorat';
        const courseDate = booking?.startTime
          ? new Date(booking.startTime * 1000).toISOString()
          : null;

        return {
          ...review.toJSON(),
          rating: review.rating ?? 0,
          courseTitle,
          courseDate
        };
      })
    );

    res.json({
      success: true,
      data: enriched,
      count: enriched.length
    });
  } catch (error) {
    console.error('Erreur fetch reviews tutor:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reviews/:bookingId - Obtenir les avis pour un booking
router.get('/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    const reviews = await Review.findAll({
      where: { bookingId },
      include: [
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'target',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    res.json({
      success: true,
      reviews,
      count: reviews.length,
      allConfirmed: reviews.length >= 2 && reviews.every(r => r.isConfirmed)
    });
  } catch (error) {
    console.error('Erreur fetch reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

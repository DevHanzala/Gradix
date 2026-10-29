import express from 'express';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadFiles } from '../middleware/uploadMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import multer from 'multer';
import { requireAssessmentAccess } from '../services/assessmentAccess.js';
import { storeQuestionImage, IMAGE_LIMITS } from '../services/questions/questionImages.js';
import { storage, publicBaseUrl } from '../helper/storage.js';
import {
  createAssessment,
  getInstructorAssessments,
  getAssessment,
  updateAssessmentData,
  deleteAssessmentData,
  enrollStudentController,
  unenrollStudentController,
  getEnrolledStudentsController,
  previewQuestions,
  generatePhysicalPaper,
  enrollGroupController,
} from '../controllers/assessmentController.js';
import { getObjectives, replaceObjectives, regenerateObjectives } from '../controllers/objectivesController.js';
import {
  listQuestions,
  getPoolStatus,
  publish,
  retryPublish,
  addQuestion,
  editQuestion,
  retireQuestion,
  approveQuestion,
  regenerateQuestion,
} from '../controllers/poolController.js';

const router = express.Router();

router.post(
  '/',
  protect,
  authorizeRoles('instructor', 'admin', 'super_admin'),
  uploadFiles.array("files", 10),
  createAssessment
);

router.get(
  '/',
  protect,
  authorizeRoles('instructor', 'admin', 'super_admin'),
  getInstructorAssessments
);

router.get('/:id', protect, getAssessment);

router.put(
  '/:id',
  protect,
  authorizeRoles('instructor', 'admin', 'super_admin'),
  uploadFiles.array("files", 10),
  updateAssessmentData
);

router.delete(
  '/:id',
  protect,
  authorizeRoles('instructor', 'admin', 'super_admin'),
  deleteAssessmentData
);

router.post('/:id/enroll', protect, authorizeRoles('instructor', 'admin', 'super_admin'), enrollStudentController);
router.post('/:id/enroll-group', protect, authorizeRoles('instructor', 'admin', 'super_admin'), enrollGroupController);
router.delete('/:id/enroll/:studentId', protect, authorizeRoles('instructor', 'admin', 'super_admin'), unenrollStudentController);
router.get('/:id/enrolled-students', protect, authorizeRoles('instructor', 'admin', 'super_admin'), getEnrolledStudentsController);

router.get('/:id/preview-questions', protect, authorizeRoles('instructor', 'admin', 'super_admin'), aiLimiter, previewQuestions);
router.post('/:id/print', protect, authorizeRoles('instructor', 'admin', 'super_admin'), aiLimiter, generatePhysicalPaper);

const staff = [protect, authorizeRoles('instructor', 'admin', 'super_admin')];
router.get('/:id/objectives', ...staff, getObjectives);
router.put('/:id/objectives', ...staff, replaceObjectives);
router.post('/:id/objectives/regenerate', ...staff, aiLimiter, regenerateObjectives);

router.post('/:id/publish', ...staff, publish);
router.post('/:id/publish/retry', ...staff, retryPublish);
router.get('/:id/pool/status', ...staff, getPoolStatus);
router.get('/:id/questions', ...staff, listQuestions);
router.post('/:id/questions', ...staff, addQuestion);
// Upload an image for a question or option (compressed, stored privately); returns its key and a preview URL.
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMAGE_LIMITS.maxBytes } });
router.post('/:id/question-images', ...staff, imageUpload.single('image'), async (req, res, next) => {
  try {
    const assessment = await requireAssessmentAccess(req.params.id, req.user);
    const stored = await storeQuestionImage(assessment.id, req.file);
    const { url } = await storage.signedUrl(stored.key, { contentType: 'image/webp', baseUrl: publicBaseUrl(req), expiresIn: 3600 });
    res.status(201).json({ success: true, data: { ...stored, url } });
  } catch (error) {
    next(error);
  }
});
router.put('/:id/questions/:questionId', ...staff, editQuestion);
router.delete('/:id/questions/:questionId', ...staff, retireQuestion);
router.post('/:id/questions/:questionId/approve', ...staff, approveQuestion);
router.post('/:id/questions/:questionId/regenerate', ...staff, aiLimiter, regenerateQuestion);

export default router;

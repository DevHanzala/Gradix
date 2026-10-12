import express from 'express';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadFiles } from '../middleware/uploadMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
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
} from '../controllers/assessmentController.js';

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
router.delete('/:id/enroll/:studentId', protect, authorizeRoles('instructor', 'admin', 'super_admin'), unenrollStudentController);
router.get('/:id/enrolled-students', protect, authorizeRoles('instructor', 'admin', 'super_admin'), getEnrolledStudentsController);

router.get('/:id/preview-questions', protect, authorizeRoles('instructor', 'admin', 'super_admin'), aiLimiter, previewQuestions);
router.post('/:id/print', protect, authorizeRoles('instructor', 'admin', 'super_admin'), aiLimiter, generatePhysicalPaper);

export default router;

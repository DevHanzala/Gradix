import express from 'express';
import multer from 'multer';
import {
  createAssessment,
  storeQuestionBlocks,
  getAssessmentsByInstructor,
  getAssessmentById,
  // updateAssessment,
  deleteAssessment,
  clearLinksForAssessment,
  storeResourceChunk,
} from '../models/assessmentModel.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { createResource, linkResourceToAssessment } from '../models/resourceModel.js';
import { extractTextFromFile, chunkText } from '../services/textProcessor.js';
import { generateEmbedding } from '../services/embeddingGenerator.js';
import {
  enrollStudentController,
  unenrollStudentController,
  getEnrolledStudentsController,
  updateAssessmentData,
  previewQuestions
} from '../controllers/assessmentController.js';

const router = express.Router();

// MULTER: IN-MEMORY ONLY → NO DISK, NO FOLDER
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',

      // PowerPoint
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Get socket from request
const getSocket = (req) => {
  const io = req.app.get('io');
  const socketId = req.body.socketId;
  return socketId ? io.sockets.sockets.get(socketId) : null;
};

// Emit progress
const emitProgress = (socket, percent, message) => {
  socket?.emit('assessment-progress', { percent, message });
};

// CREATE ASSESSMENT (FULLY IN-MEMORY)
const createAssessmentHandler = async (req, res) => {
  const socket = getSocket(req);
  try {
    let {
      title,
      prompt = null,
      externalLinks = '[]',
      question_blocks = '[]',
      selected_resources = '[]',
    } = req.body;
    const instructor_id = req.user.id;
    const files = req.files || [];

    // Parse JSON strings
    try {
      externalLinks = JSON.parse(externalLinks);
      question_blocks = JSON.parse(question_blocks);
      selected_resources = JSON.parse(selected_resources);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON in request' });
    }

    if (!prompt?.trim()) return res.status(400).json({ success: false, message: 'Prompt required' });
    if (title && !title.trim()) return res.status(400).json({ success: false, message: 'Title must be valid' });

    // Validate question blocks
    if (question_blocks.length > 0) {
      for (const b of question_blocks) {
        if (b.question_count < 1) return res.status(400).json({ success: false, message: 'Question count ≥ 1' });
        if (b.duration_per_question < 30) return res.status(400).json({ success: false, message: 'Duration ≥ 30s' });
        if (b.question_type === 'multiple_choice' && b.num_options < 2) return res.status(400).json({ success: false, message: 'MCQ needs ≥ 2 options' });
        if (b.question_type === 'matching' && (b.num_first_side < 2 || b.num_second_side < 2)) {
          return res.status(400).json({ success: false, message: 'Matching needs ≥ 2 per side' });
        }
      }
    }

    const assessmentData = {
      title: title?.trim() || null,
      prompt: prompt.trim(),
      external_links: externalLinks.filter(l => l?.trim()),
      instructor_id,
      is_executed: false,
    };

    const newAssessment = await createAssessment(assessmentData);
    emitProgress(socket, 20, 'Assessment created');

    if (question_blocks.length > 0) {
      await storeQuestionBlocks(newAssessment.id, question_blocks, instructor_id);
      emitProgress(socket, 30, 'Blocks saved');
    }

    const uploadedResources = [];
    if (files.length > 0) {
      const totalFiles = files.length;
      let processed = 0;

      for (const file of files) {
        const baseProgress = 35 + (processed / totalFiles) * 25;
        emitProgress(socket, baseProgress, `Processing: ${file.originalname}`);

        const text = await extractTextFromFile(file.buffer, file.mimetype, { socket, totalFiles, currentFile: processed + 1 });
        const chunks = chunkText(text, 500);
        emitProgress(socket, baseProgress + 25, `Chunked: ${chunks.length}`);

        const resource = await createResource({
          name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          content_type: 'file',
          visibility: 'private',
          uploaded_by: instructor_id,
        });

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i], {
            socket,
            totalChunks: chunks.length,
            currentChunk: i + 1,
            fileIndex: processed + 1,
            totalFiles
          });
          await storeResourceChunk(resource.id, chunks[i], embedding, { chunk_index: i });
        }

        await linkResourceToAssessment(newAssessment.id, resource.id);
        uploadedResources.push(resource.id);
        processed++;
        emitProgress(socket, 70 + (processed / totalFiles) * 20, `Saved: ${processed}/${totalFiles}`);
      }
    }

    if (selected_resources.length > 0) {
      for (const id of selected_resources) {
        if (!isNaN(parseInt(id))) {
          await linkResourceToAssessment(newAssessment.id, parseInt(id));
        }
      }
      emitProgress(socket, 95, 'Resources linked');
    }

    emitProgress(socket, 100, 'Done!');
    res.status(201).json({ success: true, message: 'Assessment created', data: newAssessment });
  } catch (error) {
    console.error('Create assessment error:', error);
    emitProgress(socket, 0, 'Error');
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// ROUTES
router.post('/', protect, authorizeRoles('instructor', 'admin', 'super_admin'), upload.array('new_files'), createAssessmentHandler);

router.get('/', protect, authorizeRoles('instructor', 'admin', 'super_admin'), async (req, res) => {
  const assessments = await getAssessmentsByInstructor(req.user.id);
  res.json({ success: true, data: assessments });
});

router.get('/instructor', protect, authorizeRoles('instructor', 'admin', 'super_admin'), async (req, res) => {
  const assessments = await getAssessmentsByInstructor(req.user.id);
  res.json({ success: true, data: assessments });
});

router.get('/:id', protect, async (req, res) => {
  const assessment = await getAssessmentById(req.params.id, req.user.id, req.user.role);
  assessment ? res.json({ success: true, data: assessment }) : res.status(404).json({ success: false, message: 'Not found' });
});

router.put('/:id', protect, authorizeRoles('instructor', 'admin', 'super_admin'), upload.array('new_files'), updateAssessmentData);

router.delete('/:id', protect, authorizeRoles('instructor', 'admin', 'super_admin'), async (req, res) => {
  await deleteAssessment(req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

router.post('/:id/enroll', protect, authorizeRoles('instructor', 'admin', 'super_admin'), enrollStudentController);
router.delete('/:id/enroll/:studentId', protect, authorizeRoles('instructor', 'admin', 'super_admin'), unenrollStudentController);
router.get('/:id/enrolled-students', protect, authorizeRoles('instructor', 'admin', 'super_admin'), getEnrolledStudentsController);
// Clear external links
router.put('/:id/clear-links', protect, authorizeRoles('instructor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const assessment = await clearLinksForAssessment(req.params.id);
    res.json({ success: true, data: assessment });
  } catch (error) {
    console.error("Clear links error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to clear links" });
  }
});

// Preview Questions — THIS IS THE MISSING ROUTE
router.get('/:id/preview-questions', protect, authorizeRoles('instructor', 'admin', 'super_admin'), previewQuestions);

export default router;
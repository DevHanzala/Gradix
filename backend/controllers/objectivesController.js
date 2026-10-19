import {
  getObjectivesService,
  replaceObjectivesService,
  regenerateObjectivesService,
} from "../services/objectives.service.js";

export const getObjectives = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await getObjectivesService(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
};

export const replaceObjectives = async (req, res, next) => {
  try {
    const data = await replaceObjectivesService(req.params.id, req.body?.objectives, req.user);
    res.status(200).json({ success: true, message: "Objectives saved", data });
  } catch (error) {
    next(error);
  }
};

export const regenerateObjectives = async (req, res, next) => {
  try {
    const data = await regenerateObjectivesService(req.params.id, req.user);
    res.status(202).json({ success: true, message: "Objectives are being regenerated", data });
  } catch (error) {
    next(error);
  }
};

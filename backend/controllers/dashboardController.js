import pool from "../DB/db.js";

export const getInstructorOverview = async (req, res) => {
  try {
    const instructor_id = req.user.id;
    console.log(`🔄 Fetching dashboard overview for instructor ${instructor_id}`);

    // Get assessment count
    const assessmentQuery = `
      SELECT COUNT(*) as assessment_count
      FROM assessments
      WHERE instructor_id = $1
    `;
    const assessmentResult = await pool.query(assessmentQuery, [instructor_id]);

    // Get executed assessment count
    const executedAssessmentQuery = `
      SELECT COUNT(*) as executed_count
      FROM assessments
      WHERE instructor_id = $1 AND is_executed = TRUE
    `;
    const executedResult = await pool.query(executedAssessmentQuery, [instructor_id]);

    // Get resource count
    const resourceQuery = `
      SELECT COUNT(*) as resource_count
      FROM resources
      WHERE uploaded_by = $1
    `;
    const resourceResult = await pool.query(resourceQuery, [instructor_id]);

    const overview = {
      assessments: parseInt(assessmentResult.rows[0].assessment_count, 10),
      executedAssessments: parseInt(executedResult.rows[0].executed_count, 10),
      resources: parseInt(resourceResult.rows[0].resource_count, 10),
    };

    console.log(`✅ Fetched overview: ${JSON.stringify(overview)}`);
    res.status(200).json({
      success: true,
      message: "Overview retrieved successfully",
      data: overview,
    });
  } catch (error) {
    console.error("❌ Error fetching instructor overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overview",
      error: error.message,
    });
  }
};
import db from "../DB/db.js"

// List assessments available to a student (enrolled + published), with simple status fields used by dashboard
export const getStudentAssessmentsList = async (req, res) => {
  try {
    const studentId = req.user.id
    // First check if tables exist, if not return empty array
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'enrollments'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      return res.status(200).json({ success: true, data: [] })
    }

    const { rows } = await db.query(
      `SELECT a.id, a.title, a.prompt, a.external_links, a.is_executed,
              COALESCE(aa.percentage, NULL) as score,
              aa.submitted_at
       FROM enrollments e
       JOIN assessments a ON a.id = e.assessment_id
       LEFT JOIN LATERAL (
         SELECT percentage, submitted_at FROM assessment_attempts aa
         WHERE aa.assessment_id = a.id AND aa.student_id = $1
         ORDER BY submitted_at DESC NULLS LAST LIMIT 1
       ) aa ON true
       WHERE e.student_id = $1
       ORDER BY a.id DESC`,
      [studentId]
    )
    const data = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.prompt?.slice(0, 140) || "",
      duration: 30, // AI will determine actual duration
      total_marks: 100, // AI will calculate actual marks
      end_date: null,
      submitted: !!r.submitted_at,
      submitted_at: r.submitted_at,
      score: r.score
    }))
    res.status(200).json({ success: true, data })
  } catch (error) {
    console.error("❌ getStudentAssessmentsList error:", error)
    res.status(500).json({ success: false, message: "Failed to load student assessments" })
  }
}




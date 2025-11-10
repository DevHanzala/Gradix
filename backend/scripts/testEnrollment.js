import db from "../DB/db.js"

/**
 * Test script to check enrollment data
 */
const testEnrollment = async () => {
  try {
    console.log("🔍 Testing enrollment data...")

    // Check if assessment_enrollments table has data
    const enrollmentsQuery = `
      SELECT 
        ae.assessment_id,
        ae.student_id,
        ae.enrolled_at,
        u.name as student_name,
        u.email as student_email,
        a.title as assessment_title
      FROM assessment_enrollments ae
      JOIN users u ON ae.student_id = u.id
      JOIN assessments a ON ae.assessment_id = a.id
      ORDER BY ae.enrolled_at DESC
    `
    
    const { rows: enrollments } = await db.query(enrollmentsQuery)
    console.log(`📊 Found ${enrollments.length} enrollments:`)
    enrollments.forEach((enrollment, index) => {
      console.log(`${index + 1}. ${enrollment.student_name} (${enrollment.student_email}) enrolled in "${enrollment.assessment_title}" on ${enrollment.enrolled_at}`)
    })

    // Check specific assessment (ID 13)
    if (enrollments.length > 0) {
      const assessmentId = enrollments[0].assessment_id
      console.log(`\n🔍 Testing getEnrolledStudents for assessment ${assessmentId}...`)
      
      const studentsQuery = `
        SELECT 
          u.id, 
          u.email, 
          u.name,
          ae.enrolled_at
        FROM assessment_enrollments ae
        JOIN users u ON ae.student_id = u.id
        WHERE ae.assessment_id = $1
        ORDER BY u.name
      `
      
      const { rows: students } = await db.query(studentsQuery, [assessmentId])
      console.log(`✅ Found ${students.length} enrolled students for assessment ${assessmentId}:`)
      students.forEach((student, index) => {
        console.log(`${index + 1}. ${student.name} (${student.email}) - enrolled on ${student.enrolled_at}`)
      })
    }

    console.log("\n🎉 Enrollment test completed successfully!")
    return true
  } catch (error) {
    console.error("❌ Enrollment test failed:", error)
    throw error
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnrollment()
    .then(() => {
      console.log("✅ Test completed successfully")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Test failed:", error)
      process.exit(1)
    })
}

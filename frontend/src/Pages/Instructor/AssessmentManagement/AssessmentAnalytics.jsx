import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FaChartBar, FaEye } from "react-icons/fa";
import useInstructorAnalyticsStore from "../../../store/useInstructorAssessmentAnalyticsStore";
import AnswerReview from "../../../components/assessment/AnswerReview.jsx";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageSpinner, ResponsiveTable, SkeletonList, StatCard } from "../../../components/ui";

const formatSeconds = (s) => {
  const total = Number(s) || 0;
  return `${Math.floor(total / 60)}m ${total % 60}s`;
};

function AssessmentAnalytics() {
  const { assessmentId } = useParams();
  const { assessments, students, studentQuestions, selectedStudentId, loading, fetchAssessments, fetchAssessmentStudents, fetchStudentQuestions } =
    useInstructorAnalyticsStore();
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const reviewRef = useRef(null);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    setStudentsLoaded(false);
    fetchAssessmentStudents(assessmentId).finally(() => setStudentsLoaded(true));
  }, [assessmentId, fetchAssessmentStudents]);

  useEffect(() => {
    if (selectedStudentId && studentQuestions.length) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      reviewRef.current?.focus();
    }
  }, [selectedStudentId, studentQuestions]);

  const assessment = assessments.find((a) => a.id === Number(assessmentId));
  const selectedStudent = students.find((s) => s.student_id === selectedStudentId);

  const summary = useMemo(() => {
    if (!students.length) return null;
    const avg = students.reduce((s, r) => s + (Number(r.percentage) || 0), 0) / students.length;
    const avgTime = students.reduce((s, r) => s + (Number(r.time_taken) || 0), 0) / students.length;
    return { count: students.length, avg: Math.round(avg), avgTime: Math.round(avgTime) };
  }, [students]);

  return (
    <>
      <PageHeader
        title={assessment ? `Results: ${assessment.title}` : "Results"}
        description="Scores of students who completed this assessment. Each student had their own questions."
        backTo={`/instructor/assessments/${assessmentId}`}
        backLabel="Back to assessment"
      />

      {summary && (
        <section aria-label="Summary" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Completed" value={summary.count} icon={FaChartBar} />
          <StatCard label="Average score" value={`${summary.avg}%`} />
          <StatCard label="Average time" value={formatSeconds(summary.avgTime)} />
        </section>
      )}

      <Card>
        <CardHeader title="Students" />
        {!studentsLoaded ? (
          <SkeletonList rows={3} />
        ) : students.length === 0 ? (
          <EmptyState icon={FaChartBar} title="No completed attempts yet" description="Results appear here as soon as students submit." />
        ) : (
          <ResponsiveTable
            caption="Student results"
            rowKey={(s) => s.student_id}
            rows={students}
            columns={[
              { key: "name", header: "Student", primary: true },
              { key: "correct", header: "Correct", render: (s) => `${s.correct_answers} / ${s.total_questions}` },
              {
                key: "percentage",
                header: "Score",
                render: (s) => <Badge tone={s.percentage >= 50 ? "success" : "danger"}>{s.percentage}%</Badge>,
              },
              { key: "time", header: "Time", render: (s) => s.time_used },
            ]}
            actions={(s) => (
              <Button
                variant={selectedStudentId === s.student_id ? "primary" : "secondary"}
                icon={FaEye}
                onClick={() => fetchStudentQuestions(assessmentId, s.student_id)}
              >
                Review answers
              </Button>
            )}
          />
        )}
      </Card>

      {loading && studentsLoaded && students.length > 0 && !studentQuestions.length && <PageSpinner label="Loading answers…" />}

      {selectedStudent && studentQuestions.length > 0 && (
        <section ref={reviewRef} tabIndex={-1} aria-label={`Answers of ${selectedStudent.name}`} className="mt-6 focus:outline-none">
          <Card>
            <CardHeader title={`Answers: ${selectedStudent.name}`} description={`${selectedStudent.correct_answers} correct · ${selectedStudent.percentage}%`} />
            <CardBody>
              <AnswerReview items={studentQuestions} />
            </CardBody>
          </Card>
        </section>
      )}
    </>
  );
}

export default AssessmentAnalytics;

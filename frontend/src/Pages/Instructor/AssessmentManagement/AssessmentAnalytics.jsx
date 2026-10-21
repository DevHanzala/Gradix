import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaChartBar, FaEye } from "react-icons/fa";
import useInstructorAnalyticsStore from "../../../store/useInstructorAssessmentAnalyticsStore";
import AnswerReview from "../../../components/assessment/AnswerReview.jsx";
import { formatDuration, formatNumber, formatPercent } from "../../../utils/format.js";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageSpinner, ResponsiveTable, SkeletonList, StatCard } from "../../../components/ui";

function AssessmentAnalytics() {
  const { t } = useTranslation();
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
    return { count: students.length, avg, avgTime: Math.round(avgTime) };
  }, [students]);

  return (
    <>
      <PageHeader
        title={assessment ? t("analytics.titleFor", { title: assessment.title }) : t("assessments.results")}
        description={t("analytics.description")}
        backTo={`/instructor/assessments/${assessmentId}`}
        backLabel={t("assessments.backToAssessment")}
      />

      {summary && (
        <section aria-label={t("dashboard.summary")} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label={t("studentDashboard.completed")} value={formatNumber(summary.count)} icon={FaChartBar} />
          <StatCard label={t("analytics.averageScore")} value={formatPercent(summary.avg, 0)} />
          <StatCard label={t("analytics.averageTime")} value={formatDuration(summary.avgTime)} />
        </section>
      )}

      <Card>
        <CardHeader title={t("analytics.students")} />
        {!studentsLoaded ? (
          <SkeletonList rows={3} />
        ) : students.length === 0 ? (
          <EmptyState icon={FaChartBar} title={t("analytics.none")} description={t("analytics.noneDescription")} />
        ) : (
          <ResponsiveTable
            caption={t("analytics.studentResults")}
            rowKey={(s) => s.student_id}
            rows={students}
            columns={[
              { key: "name", header: t("analytics.student"), primary: true },
              {
                key: "correct",
                header: t("analytics.correct"),
                render: (s) => t("analytics.correctOf", { correct: formatNumber(s.correct_answers), total: formatNumber(s.total_questions) }),
              },
              {
                key: "percentage",
                header: t("analytics.score"),
                render: (s) => <Badge tone={s.percentage >= 50 ? "success" : "danger"}>{formatPercent(s.percentage)}</Badge>,
              },
              { key: "time", header: t("analytics.time"), render: (s) => formatDuration(s.time_taken) },
            ]}
            actions={(s) => (
              <Button
                variant={selectedStudentId === s.student_id ? "primary" : "secondary"}
                icon={FaEye}
                onClick={() => fetchStudentQuestions(assessmentId, s.student_id)}
              >
                {t("analytics.reviewAnswers")}
              </Button>
            )}
          />
        )}
      </Card>

      {loading && studentsLoaded && students.length > 0 && !studentQuestions.length && <PageSpinner label={t("analytics.loadingAnswers")} />}

      {selectedStudent && studentQuestions.length > 0 && (
        <section
          ref={reviewRef}
          tabIndex={-1}
          aria-label={t("analytics.answersOf", { name: selectedStudent.name })}
          className="mt-6 focus:outline-none"
        >
          <Card>
            <CardHeader
              title={t("analytics.answersOf", { name: selectedStudent.name })}
              description={t("analytics.answersSummary", {
                correct: formatNumber(selectedStudent.correct_answers),
                score: formatPercent(selectedStudent.percentage),
              })}
            />
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

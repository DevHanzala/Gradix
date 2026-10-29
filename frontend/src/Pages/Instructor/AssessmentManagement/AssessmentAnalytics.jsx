import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaChartBar, FaDownload, FaEye } from "react-icons/fa";
import { exportResultsAPI, fetchInsightsAPI } from "../../../api/instructorAnalytics.api.js";
import ObjectiveBars from "../../../components/results/ObjectiveBars.jsx";
import ScoreDistribution from "../../../components/insights/ScoreDistribution.jsx";
import { errorMessage } from "../../../utils/forms.js";
import useInstructorAnalyticsStore from "../../../store/useInstructorAssessmentAnalyticsStore";
import AnswerReview from "../../../components/assessment/AnswerReview.jsx";
import { formatDateTime, formatDuration, formatNumber, formatPercent } from "../../../utils/format.js";
import apiClient from "../../../lib/apiClient.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, PageHeader, PageSpinner, ResponsiveTable, SkeletonList, StatCard } from "../../../components/ui";

function AssessmentAnalytics() {
  const { t } = useTranslation();
  const { assessmentId } = useParams();
  const { assessments, students, studentQuestions, selectedStudentId, loading, fetchAssessments, fetchAssessmentStudents, fetchStudentQuestions } =
    useInstructorAnalyticsStore();
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [exporting, setExporting] = useState(null);
  const reviewRef = useRef(null);

  const loadInsights = useCallback(async () => {
    setInsightsError(null);
    try {
      setInsights((await fetchInsightsAPI(assessmentId)).data.data);
    } catch (e) {
      setInsightsError(errorMessage(e, t("insights.loadFailed")));
    }
  }, [assessmentId, t]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const download = async (format) => {
    setExporting(format);
    try {
      const res = await exportResultsAPI(assessmentId, format);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradix-results-${assessmentId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setInsightsError(errorMessage(e, t("insights.exportFailed")));
    } finally {
      setExporting(null);
    }
  };

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

  const [timeline, setTimeline] = useState(null);
  const openTimeline = async (s) => {
    try {
      const res = await apiClient.get(`/assessments/${assessmentId}/attempts/${s.attempt_id}/integrity`);
      setTimeline({ name: s.name, ...res.data.data });
    } catch {
      setTimeline({ name: s.name, events: [], error: true });
    }
  };

  return (
    <>
      <PageHeader
        title={assessment ? t("analytics.titleFor", { title: assessment.title }) : t("assessments.results")}
        description={t("analytics.description")}
        backTo={`/instructor/assessments/${assessmentId}`}
        backLabel={t("assessments.backToAssessment")}
        actions={
          <>
            <Button variant="secondary" icon={FaDownload} loading={exporting === "csv"} onClick={() => download("csv")}>
              {t("insights.exportCsv")}
            </Button>
            <Button variant="secondary" icon={FaDownload} loading={exporting === "xlsx"} onClick={() => download("xlsx")}>
              {t("insights.exportXlsx")}
            </Button>
          </>
        }
      />

      {insightsError && (
        <Alert tone="danger" className="mb-6">
          {insightsError}
        </Alert>
      )}

      {insights && insights.summary.students > 0 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("insights.distribution")} description={t("insights.medianLine", { median: formatPercent(insights.summary.medianRaw ?? 0) })} />
            <CardBody>
              <ScoreDistribution buckets={insights.distribution} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("insights.byObjective")} description={t("insights.byObjectiveHint")} />
            <CardBody>
              <ObjectiveBars
                objectives={insights.objectives.filter((o) => o.accuracy !== null)}
                weakIds={new Set(insights.hardestObjectives.filter((o) => o.accuracy < 60).map((o) => o.objectiveId))}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("insights.hardest")} />
            <CardBody>
              {insights.hardestObjectives.length === 0 ? (
                <p className="text-sm text-ink-muted">{t("learning.noObjectives")}</p>
              ) : (
                <ol className="space-y-2">
                  {insights.hardestObjectives.map((o) => (
                    <li key={o.objectiveId} className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-ink" dir="auto">
                        {t("learning.objectiveRow", { number: o.number, text: o.text })}
                      </span>
                      <span className="tabular-nums text-ink-muted">{formatPercent(o.accuracy)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("insights.difficultyReached")} description={t("insights.difficultyReachedHint")} />
            <ResponsiveTable
              caption={t("insights.difficultyReached")}
              rowKey={(r) => r.level}
              rows={insights.difficultyReached}
              columns={[
                { key: "level", header: t("bank.difficultyLabel"), primary: true, render: (r) => t(`bank.levels.${r.level}`) },
                { key: "final", header: t("insights.finalLevel"), render: (r) => formatNumber(r.final) },
                { key: "highest", header: t("insights.highestLevel"), render: (r) => formatNumber(r.highest) },
              ]}
            />
          </Card>
        </div>
      )}

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
              {
                key: "integrity",
                header: t("analytics.integrity"),
                render: (s) =>
                  s.violation_count > 0 ? (
                    <button type="button" className="inline-flex min-h-11 items-center text-warning-700 underline" onClick={() => openTimeline(s)}>
                      {t("analytics.violations", { value: formatNumber(s.violation_count) })}
                      {s.auto_submitted_reason && ` · ${t("analytics.autoSubmitted")}`}
                    </button>
                  ) : (
                    "–"
                  ),
              },
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
      <Modal isOpen={Boolean(timeline)} onClose={() => setTimeline(null)} title={t("analytics.timelineTitle", { name: timeline?.name || "" })}>
        {timeline?.error ? (
          <Alert tone="danger">{t("analytics.timelineFailed")}</Alert>
        ) : (
          <ol className="space-y-2 text-sm">
            {(timeline?.events || []).map((e, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-line pb-1">
                <span>{t(`analytics.events.${e.kind}`)}{e.question_index !== null ? ` · ${t("analytics.onQuestion", { n: e.question_index + 1 })}` : ""}</span>
                <span className="tabular-nums text-ink-muted">{formatDateTime(e.occurred_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}

export default AssessmentAnalytics;

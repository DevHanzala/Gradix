import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBullseye, FaChartLine, FaCheckCircle, FaClock, FaDownload, FaListOl } from "react-icons/fa";
import { downloadReportAPI, fetchResultsAPI } from "../../api/studentAnalytics.api.js";
import AnswerReview from "../../components/assessment/AnswerReview.jsx";
import ObjectiveBars from "../../components/results/ObjectiveBars.jsx";
import DifficultyPathChart from "../../components/results/DifficultyPathChart.jsx";
import StudyPlanPanel from "../../components/results/StudyPlanPanel.jsx";
import PracticeQuiz from "../../components/results/PracticeQuiz.jsx";
import { Alert, Button, Card, CardBody, CardHeader, PageHeader, Select, SkeletonList, StatCard } from "../../components/ui";
import { errorMessage } from "../../utils/forms.js";
import { formatDuration, formatNumber, formatPercent } from "../../utils/format.js";
import { LANGUAGES } from "../../utils/languages.js";
import { textDirection } from "../../utils/text.js";

/**
 * Results of one completed attempt: scores, accuracy, time, per-objective
 * bars, difficulty path, weak areas, AI study plan, PDF report, practice and
 * the full review. Available only after submitting (the API returns 404 before).
 */
function Results() {
  const { t, i18n } = useTranslation();
  const { assessmentId } = useParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [language, setLanguage] = useState(i18n.language);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetchResultsAPI(assessmentId);
      setData(res.data.data);
    } catch (e) {
      setLoadError(errorMessage(e, t("results.loadFailed")));
    }
  }, [assessmentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await downloadReportAPI(assessmentId, language);
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradix-report-${assessmentId}-${language}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(errorMessage(e, t("errors.store.report")));
    } finally {
      setDownloading(false);
    }
  };

  const header = <PageHeader title={data?.title || t("nav.results")} backTo="/student/analytics" backLabel={t("learning.allResults")} />;

  if (loadError) {
    return (
      <>
        {header}
        <Alert
          tone="danger"
          title={t("results.loadFailed")}
          action={
            <Button variant="secondary" onClick={load}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {loadError}
        </Alert>
      </>
    );
  }
  if (!data) {
    return (
      <>
        {header}
        <Card>
          <SkeletonList rows={5} />
        </Card>
      </>
    );
  }

  const weakIds = new Set(data.weakAreas.map((w) => w.objectiveId));
  const hasObjectives = data.objectives.length > 0;

  return (
    <>
      <PageHeader
        title={data.title}
        description={t("learning.description")}
        backTo="/student/analytics"
        backLabel={t("learning.allResults")}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label={t("learning.reportLanguage")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
            />
            <Button variant="secondary" icon={FaDownload} loading={downloading} onClick={download}>
              {t("results.downloadReport")}
            </Button>
          </div>
        }
      />
      {downloadError && (
        <Alert tone="danger" className="mb-6">
          {downloadError}
        </Alert>
      )}

      <section aria-label={t("dashboard.summary")} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("results.raw")} value={formatPercent(data.scores.rawPercentage)} icon={FaBullseye} hint={t("results.scoreOf", { score: formatNumber(data.scores.score), total: formatNumber(data.scores.totalMarks) })} />
        <StatCard
          label={t("results.adjusted")}
          value={data.scores.adjustedPercentage === null ? "–" : formatPercent(data.scores.adjustedPercentage)}
          icon={FaChartLine}
          hint={t("learning.adjustedHint")}
        />
        <StatCard
          label={t("learning.accuracy")}
          value={formatPercent(data.accuracy.percentage)}
          icon={FaCheckCircle}
          hint={t("learning.accuracyHint", { correct: formatNumber(data.accuracy.correct), total: formatNumber(data.accuracy.totalQuestions) })}
        />
        <StatCard
          label={t("analytics.time")}
          value={formatDuration(data.time.totalSeconds)}
          icon={FaClock}
          hint={t("learning.perQuestion", { time: formatDuration(data.time.averagePerQuestionSeconds) })}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("learning.byObjective")} description={t("learning.byObjectiveHint")} />
          <CardBody>
            <ObjectiveBars objectives={data.objectives} weakIds={weakIds} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("learning.difficultyPath")} description={data.adaptive ? t("learning.pathAdaptive") : t("learning.pathFixed")} />
          <CardBody>
            <DifficultyPathChart path={data.difficultyPath} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title={t("learning.weakAreas")} />
        <CardBody>
          {!hasObjectives ? (
            <p className="text-sm text-ink-muted">{t("learning.noObjectives")}</p>
          ) : data.weakAreas.length === 0 ? (
            <p className="text-ink">{t("learning.noWeakAreas")}</p>
          ) : (
            <ul className="space-y-2">
              {data.weakAreas.map((w) => (
                <li key={w.objectiveId} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink" dir={textDirection(w.text)}>
                    {t("learning.objectiveRow", { number: w.number, text: w.text })}
                  </span>
                  <span className="tabular-nums text-ink-muted">{formatPercent(w.accuracy)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("learning.planTitle")} description={t("learning.planDescription")} />
          <CardBody>
            <StudyPlanPanel key={language} assessmentId={assessmentId} language={language} hasObjectives={hasObjectives} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("learning.practiceTitle")} description={t("learning.practiceDescription")} />
          <CardBody>
            <PracticeQuiz key={language} assessmentId={assessmentId} language={language} hasObjectives={hasObjectives} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <FaListOl aria-hidden="true" />
              {t("results.review")}
            </span>
          }
          description={t("results.reviewDescription")}
        />
        <CardBody>
          <AnswerReview
            items={data.review}
            objectives={data.objectives.map((o) => ({ id: o.objectiveId, text: o.text }))}
          />
        </CardBody>
      </Card>
    </>
  );
}

export default Results;

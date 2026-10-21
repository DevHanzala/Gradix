import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaCloudUploadAlt, FaFolderOpen, FaTrash } from "react-icons/fa";
import useResourceStore from "../../../store/resourceStore.js";
import { validateFiles } from "../../../schemas/resourceSchema.js";
import { ACCEPTED_FILE_TYPES } from "../../../schemas/assessmentSchemas.js";
import { errorMessage } from "../../../utils/forms.js";
import { formatDate, formatNumber } from "../../../utils/format.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList } from "../../../components/ui";

/** File size in the UI language (Intl unit formatting). */
const formatSize = (bytes) => {
  const n = Number(bytes);
  if (!n) return "–";
  if (n < 1024 * 1024) return formatNumber(Math.max(1, Math.round(n / 1024)), { style: "unit", unit: "kilobyte", unitDisplay: "short" });
  return formatNumber(n / (1024 * 1024), { style: "unit", unit: "megabyte", unitDisplay: "short", maximumFractionDigits: 1 });
};

const typeKey = (mime, contentType) => {
  if (contentType === "link") return "link";
  if (!mime) return "file";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word")) return "word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "powerpoint";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/")) return "text";
  return "file";
};

function ResourceManagement() {
  const { t } = useTranslation();
  const { resources, fetchResources, uploadResources, deleteResource } = useResourceStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [shared, setShared] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    await fetchResources();
    const { error } = useResourceStore.getState();
    if (error) setLoadError(error);
    setLoading(false);
  }, [fetchResources]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files) => {
    setSkipped([]);
    if (!files.length) return;
    const validation = validateFiles(files);
    if (!validation.success) {
      toast.error(validation.error);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadResources(files, { visibility: shared ? "public" : "private" });
      setSkipped(result.skipped);
      toast.success(t("resources.added", { count: formatNumber(result.resources.length) }));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t("resources.uploadFailed")));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    upload(Array.from(e.dataTransfer.files || []));
  };

  const confirmDelete = async () => {
    try {
      await deleteResource(deleteTarget.id);
      toast.success(t("resources.deleted", { name: deleteTarget.name }));
    } catch (error) {
      toast.error(errorMessage(error, t("resources.deleteFailed")));
    }
  };

  return (
    <>
      <PageHeader title={t("nav.resources")} description={t("resources.description")} />

      <Card className="mb-6">
        <CardHeader title={t("resources.uploadTitle")} />
        <CardBody className="space-y-4">
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-8 text-center transition ${
              dragActive ? "border-primary-600 bg-primary-50" : "border-line-strong"
            }`}
          >
            <FaCloudUploadAlt className="text-4xl text-primary-600" aria-hidden="true" />
            <p className="font-semibold text-ink">{t("resources.dropHere")}</p>
            <p className="text-sm text-ink-subtle">{t("resources.uploadHint")}</p>
            <input
              ref={inputRef}
              id="resource-files"
              aria-label={t("resources.chooseFilesLabel")}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="sr-only"
              onChange={(e) => upload(Array.from(e.target.files || []))}
              disabled={uploading}
            />
            <Button loading={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? t("resources.indexing") : t("resources.chooseFiles")}
            </Button>
          </div>
          <Checkbox label={t("resources.share")} description={t("resources.shareDescription")} checked={shared} onChange={(e) => setShared(e.target.checked)} />
          {skipped.length > 0 && (
            <Alert tone="warning" title={t("resources.skippedTitle")}>
              <ul className="list-disc space-y-1 ps-5">
                {skipped.map((s) => (
                  <li key={s.file}>{s.reason || s.file}</li>
                ))}
              </ul>
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("resources.mine")} />
        {loading ? (
          <SkeletonList rows={4} />
        ) : loadError ? (
          <div className="p-4 sm:p-6">
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" onClick={load}>
                  {t("common.tryAgain")}
                </Button>
              }
            >
              {loadError}
            </Alert>
          </div>
        ) : resources.length === 0 ? (
          <EmptyState icon={FaFolderOpen} title={t("resources.none")} description={t("resources.noneDescription")} />
        ) : (
          <ResponsiveTable
            caption={t("resources.mine")}
            rows={resources}
            columns={[
              {
                key: "name",
                header: t("profile.name"),
                primary: true,
                render: (r) => (
                  <span className="break-all" dir="auto">
                    {r.name}
                  </span>
                ),
              },
              { key: "type", header: t("resources.type"), render: (r) => t(`resources.types.${typeKey(r.file_type, r.content_type)}`) },
              { key: "size", header: t("resources.size"), render: (r) => formatSize(r.file_size) },
              {
                key: "visibility",
                header: t("resources.visibility"),
                render: (r) => (r.visibility === "public" ? <Badge tone="primary">{t("resources.public")}</Badge> : <Badge>{t("resources.private")}</Badge>),
              },
              { key: "created_at", header: t("resources.addedOn"), render: (r) => formatDate(r.created_at) },
            ]}
            actions={(r) => (
              <Button variant="ghost" icon={FaTrash} className="text-danger-700 hover:bg-danger-50" onClick={() => setDeleteTarget(r)}>
                {t("common.delete")}
              </Button>
            )}
          />
        )}
      </Card>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        type="warning"
        title={deleteTarget ? t("resources.deleteTitle", { name: deleteTarget.name }) : ""}
        onConfirm={confirmDelete}
        confirmText={t("resources.deleteConfirm")}
        confirmVariant="danger"
      >
        {t("resources.deleteBody")}
      </Modal>
    </>
  );
}

export default ResourceManagement;

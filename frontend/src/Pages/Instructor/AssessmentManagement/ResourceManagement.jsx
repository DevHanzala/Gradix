import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaCloudUploadAlt, FaFolderOpen, FaLink, FaTrash } from "react-icons/fa";
import useResourceStore from "../../../store/resourceStore.js";
import { addLinkResourceAPI, searchResourcesAPI } from "../../../api/resource.api.js";
import { validateFiles } from "../../../schemas/resourceSchema.js";
import { ACCEPTED_FILE_TYPES } from "../../../schemas/assessmentSchemas.js";
import { errorMessage } from "../../../utils/forms.js";
import { formatDate, formatNumber } from "../../../utils/format.js";
import { LANGUAGE_NAMES } from "../../../utils/languages.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ResponsiveTable,
  Select,
  SkeletonList,
} from "../../../components/ui";

const PAGE_SIZE = 20;

/** File size in the UI language (Intl unit formatting). */
const formatSize = (bytes) => {
  const n = Number(bytes);
  if (!n) return "–";
  if (n < 1024 * 1024) return formatNumber(Math.max(1, Math.round(n / 1024)), { style: "unit", unit: "kilobyte", unitDisplay: "short" });
  return formatNumber(n / (1024 * 1024), { style: "unit", unit: "megabyte", unitDisplay: "short", maximumFractionDigits: 1 });
};

const typeKey = (r) => {
  if (r.content_type === "link") return r.extraction_method === "youtube" ? "youtube" : "link";
  const mime = r.file_type || "";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word")) return "word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "powerpoint";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/")) return "text";
  return "file";
};

function ResourceManagement() {
  const { t } = useTranslation();
  const { uploadResources, deleteResource } = useResourceStore();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState({ search: "", type: "", visibility: "", language: "" });
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [shared, setShared] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, page_size: PAGE_SIZE }).filter(([, v]) => v !== ""));
      setData((await searchResourcesAPI(params)).data.data);
    } catch (error) {
      setLoadError(errorMessage(error, t("resources.loadFailed")));
    }
  }, [filters, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const reportAdded = (resources) => {
    const duplicates = resources.filter((r) => r.duplicate).length;
    if (resources.length - duplicates > 0) toast.success(t("resources.added", { count: formatNumber(resources.length - duplicates) }));
    if (duplicates) toast(t("resources.duplicates", { count: formatNumber(duplicates) }));
  };

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
      reportAdded(result.resources);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t("resources.uploadFailed")));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const addLink = async (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setAddingLink(true);
    try {
      const res = await addLinkResourceAPI(linkUrl.trim(), { visibility: shared ? "public" : "private" });
      reportAdded(res.data.resources || []);
      setLinkUrl("");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t("resources.linkFailed")));
    } finally {
      setAddingLink(false);
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
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t("resources.deleteFailed")));
    }
  };

  return (
    <>
      <PageHeader title={t("nav.resources")} description={t("resources.description")} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
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
          <CardHeader title={t("resources.linkTitle")} description={t("resources.linkDescription")} />
          <CardBody className="space-y-4">
            <form onSubmit={addLink} className="space-y-3">
              <Input
                label={t("resources.linkUrl")}
                type="url"
                inputMode="url"
                dir="ltr"
                placeholder="https://"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <Button type="submit" icon={FaLink} loading={addingLink} disabled={!linkUrl.trim()}>
                {addingLink ? t("resources.indexing") : t("resources.addLink")}
              </Button>
            </form>
            <Checkbox label={t("resources.share")} description={t("resources.shareDescription")} checked={shared} onChange={(e) => setShared(e.target.checked)} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("resources.mine")} description={data ? t("resources.total", { count: formatNumber(data.total) }) : undefined} />
        <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <Input label={t("common.search")} type="search" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} />
          <Select
            label={t("resources.type")}
            value={filters.type}
            onChange={(e) => setFilter({ type: e.target.value })}
            options={[
              { value: "", label: t("common.all") },
              { value: "file", label: t("resources.types.file") },
              { value: "link", label: t("resources.types.link") },
            ]}
          />
          <Select
            label={t("resources.visibility")}
            value={filters.visibility}
            onChange={(e) => setFilter({ visibility: e.target.value })}
            options={[
              { value: "", label: t("common.all") },
              { value: "private", label: t("resources.private") },
              { value: "public", label: t("resources.public") },
            ]}
          />
          <Select
            label={t("common.language")}
            value={filters.language}
            onChange={(e) => setFilter({ language: e.target.value })}
            options={[{ value: "", label: t("common.all") }, ...Object.entries(LANGUAGE_NAMES).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        {loadError ? (
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
        ) : !data ? (
          <SkeletonList rows={4} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={FaFolderOpen}
            title={Object.values(filters).some(Boolean) ? t("resources.noMatch") : t("resources.none")}
            description={Object.values(filters).some(Boolean) ? undefined : t("resources.noneDescription")}
          />
        ) : (
          <ResponsiveTable
            caption={t("resources.mine")}
            rows={data.items}
            columns={[
              {
                key: "name",
                header: t("profile.name"),
                primary: true,
                render: (r) => (
                  <span className="break-all" dir="auto">
                    {r.content_type === "link" && r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
                        {r.name}
                      </a>
                    ) : (
                      r.name
                    )}
                  </span>
                ),
              },
              { key: "type", header: t("resources.type"), render: (r) => t(`resources.types.${typeKey(r)}`) },
              { key: "language", header: t("common.language"), render: (r) => (r.language ? LANGUAGE_NAMES[r.language] || r.language : "–") },
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
        {data && data.pages > 1 && (
          <nav className="flex items-center justify-between gap-2 border-t border-line p-4" aria-label={t("common.pages")}>
            <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              {t("common.previous")}
            </Button>
            <span className="text-sm text-ink-muted">{t("common.pageOf", { page: data.page, pages: data.pages })}</span>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages}>
              {t("common.next")}
            </Button>
          </nav>
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

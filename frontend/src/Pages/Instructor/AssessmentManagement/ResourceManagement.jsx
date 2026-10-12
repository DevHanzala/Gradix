import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FaCloudUploadAlt, FaFolderOpen, FaTrash } from "react-icons/fa";
import useResourceStore from "../../../store/resourceStore.js";
import { validateFiles } from "../../../schemas/resourceSchema.js";
import { ACCEPTED_FILE_TYPES } from "../../../schemas/assessmentSchemas.js";
import { errorMessage } from "../../../utils/forms.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList } from "../../../components/ui";

const formatSize = (bytes) => {
  const n = Number(bytes);
  if (!n) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const shortType = (mime, contentType) => {
  if (contentType === "link") return "Link";
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word")) return "Word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PowerPoint";
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("text/")) return "Text";
  return "File";
};

function ResourceManagement() {
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
      toast.success(`${result.resources.length} resource${result.resources.length === 1 ? "" : "s"} added.`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Upload failed."));
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
      toast.success(`"${deleteTarget.name}" was deleted.`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete the resource."));
    }
  };

  return (
    <>
      <PageHeader title="Resources" description="Teaching material your assessments can generate questions from." />

      <Card className="mb-6">
        <CardHeader title="Upload material" />
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
            <p className="font-semibold text-ink">Drag files here or choose them</p>
            <p className="text-sm text-ink-subtle">PDF, Word, PowerPoint, text or images, up to 10 files of 10 MB. Scans are read with OCR.</p>
            <input
              ref={inputRef}
              id="resource-files"
              aria-label="Choose files to upload"
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="sr-only"
              onChange={(e) => upload(Array.from(e.target.files || []))}
              disabled={uploading}
            />
            <Button loading={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? "Reading and indexing…" : "Choose files"}
            </Button>
          </div>
          <Checkbox
            label="Share with other instructors"
            description="Public resources can be selected by any instructor. Private ones are visible only to you."
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          {skipped.length > 0 && (
            <Alert tone="warning" title="Some files could not be used">
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
        <CardHeader title="My resources" />
        {loading ? (
          <SkeletonList rows={4} />
        ) : loadError ? (
          <div className="p-4 sm:p-6">
            <Alert tone="danger" action={<Button variant="secondary" onClick={load}>Try again</Button>}>
              {loadError}
            </Alert>
          </div>
        ) : resources.length === 0 ? (
          <EmptyState icon={FaFolderOpen} title="No resources yet" description="Upload your first file above." />
        ) : (
          <ResponsiveTable
            caption="My resources"
            rows={resources}
            columns={[
              { key: "name", header: "Name", primary: true, render: (r) => <span className="break-all">{r.name}</span> },
              { key: "type", header: "Type", render: (r) => shortType(r.file_type, r.content_type) },
              { key: "size", header: "Size", render: (r) => formatSize(r.file_size) },
              {
                key: "visibility",
                header: "Visibility",
                render: (r) => (r.visibility === "public" ? <Badge tone="primary">Public</Badge> : <Badge>Private</Badge>),
              },
              { key: "created_at", header: "Added", render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : "–") },
            ]}
            actions={(r) => (
              <Button variant="ghost" icon={FaTrash} className="text-danger-700 hover:bg-danger-50" onClick={() => setDeleteTarget(r)}>
                Delete
              </Button>
            )}
          />
        )}
      </Card>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        type="warning"
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ""}
        onConfirm={confirmDelete}
        confirmText="Delete resource"
        confirmVariant="danger"
      >
        Assessments that use it will no longer generate questions from it.
      </Modal>
    </>
  );
}

export default ResourceManagement;

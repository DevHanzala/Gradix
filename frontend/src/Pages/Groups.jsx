import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaLayerGroup, FaPlus, FaTrash, FaUserMinus, FaUsers } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import {
  addGroupMembersApi,
  createGroupApi,
  deleteGroupApi,
  fetchGroupMembersApi,
  fetchGroupsApi,
  removeGroupMemberApi,
} from "../api/groups.api.js";
import { errorMessage } from "../utils/forms.js";
import { formatNumber } from "../utils/format.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, PageHeader, ResponsiveTable, SkeletonList, Textarea } from "../components/ui";

/**
 * Groups (classes, departments). The super admin creates groups and manages
 * members; admins see the groups they belong to (their scope for role changes).
 */
function Members({ group, canManage, onChanged }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [emails, setEmails] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData((await fetchGroupMembersApi(group.id)).data.data);
    } catch (e) {
      setError(errorMessage(e, t("groups.membersFailed")));
    }
  }, [group.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    const list = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!list.length) return;
    setSaving(true);
    try {
      const res = await addGroupMembersApi(group.id, list);
      setResult(res.data.data);
      setEmails("");
      await load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("groups.addFailed")));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (member) => {
    try {
      await removeGroupMemberApi(group.id, member.id);
      await load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err, t("groups.removeFailed")));
    }
  };

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <SkeletonList rows={3} />;

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={add} className="space-y-3">
          <Textarea
            label={t("groups.addMembers")}
            hint={t("groups.addMembersHint")}
            rows={3}
            dir="ltr"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
          <Button type="submit" icon={FaPlus} loading={saving} disabled={!emails.trim()}>
            {t("groups.addButton")}
          </Button>
          {result && (
            <Alert tone={result.notFound.length ? "warning" : "success"}>
              {t("groups.added", { count: formatNumber(result.added) })}
              {result.notFound.length > 0 && (
                <span className="block" dir="ltr">
                  {t("groups.notFound", { emails: result.notFound.join(", ") })}
                </span>
              )}
            </Alert>
          )}
        </form>
      )}
      {data.members.length === 0 ? (
        <EmptyState icon={FaUsers} title={t("groups.noMembers")} />
      ) : (
        <ResponsiveTable
          caption={t("groups.members")}
          rows={data.members}
          columns={[
            { key: "name", header: t("profile.name"), primary: true },
            { key: "email", header: t("auth.email"), render: (m) => <span dir="ltr">{m.email}</span> },
            { key: "role", header: t("profile.role"), render: (m) => <Badge>{t(`roles.${m.role}`)}</Badge> },
          ]}
          actions={
            canManage
              ? (m) => (
                  <Button variant="ghost" icon={FaUserMinus} className="text-danger-700" onClick={() => remove(m)}>
                    {t("common.remove")}
                  </Button>
                )
              : undefined
          }
        />
      )}
    </div>
  );
}

function Groups() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === "super_admin";
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGroups((await fetchGroupsApi()).data.data);
    } catch (e) {
      setError(errorMessage(e, t("groups.loadFailed")));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setFormError(null);
    try {
      const res = await createGroupApi(form);
      setCreating(false);
      setForm({ name: "", description: "" });
      await load();
      setSelected(res.data.data);
    } catch (e) {
      setFormError(errorMessage(e, t("groups.createFailed")));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteGroupApi(deleteTarget.id);
      if (selected?.id === deleteTarget.id) setSelected(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, t("groups.deleteFailed")));
    }
  };

  return (
    <>
      <PageHeader
        title={t("nav.groups")}
        description={canManage ? t("groups.descriptionSuper") : t("groups.descriptionAdmin")}
        actions={
          canManage && (
            <Button icon={FaPlus} onClick={() => setCreating(true)}>
              {t("groups.create")}
            </Button>
          )
        }
      />
      {error ? (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" onClick={load}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader title={t("groups.all")} />
            {!groups ? (
              <SkeletonList rows={3} />
            ) : groups.length === 0 ? (
              <EmptyState icon={FaLayerGroup} title={t("groups.none")} description={canManage ? t("groups.noneSuper") : t("groups.noneAdmin")} />
            ) : (
              <ul className="divide-y divide-line">
                {groups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(g)}
                      aria-current={selected?.id === g.id ? "true" : undefined}
                      className={`min-h-11 flex-1 rounded-control px-2 text-start ${selected?.id === g.id ? "bg-primary-50 font-semibold text-primary-700" : "text-ink hover:bg-gray-50"}`}
                    >
                      <span className="block">{g.name}</span>
                      <span className="block text-xs text-ink-subtle">
                        {t("groups.counts", { members: formatNumber(g.memberCount), students: formatNumber(g.studentCount) })}
                      </span>
                    </button>
                    {canManage && (
                      <Button variant="ghost" icon={FaTrash} className="text-danger-700" aria-label={t("groups.deleteOne", { name: g.name })} onClick={() => setDeleteTarget(g)}>
                        <span className="sr-only">{t("common.delete")}</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader title={selected ? selected.name : t("groups.members")} description={selected?.description || undefined} />
            <CardBody>
              {selected ? (
                <Members key={selected.id} group={selected} canManage={canManage} onChanged={load} />
              ) : (
                <p className="text-sm text-ink-muted">{t("groups.selectOne")}</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title={t("groups.create")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={create} disabled={form.name.trim().length < 2}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Input label={t("groups.name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Textarea label={t("groups.descriptionLabel")} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        type="warning"
        title={deleteTarget ? t("groups.deleteTitle", { name: deleteTarget.name }) : ""}
        onConfirm={confirmDelete}
        confirmText={t("common.delete")}
        confirmVariant="danger"
      >
        {t("groups.deleteBody")}
      </Modal>
    </>
  );
}

export default Groups;

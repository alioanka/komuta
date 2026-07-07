'use client';

/**
 * Create / edit user modal, including the per-user permission editor
 * (role defaults + grants/revokes) and company/outlet scope pickers.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Permission, Role } from '@komuta/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/ui/overlay';
import { Badge, Button, Field, FieldError, Input, Select, Switch, cn } from '@/components/ui';
import {
  ROLE_OPTIONS,
  permissionActionLabel,
  permissionResourceLabel,
  roleLabel,
} from '@/lib/labels';
import { MSG, isValidE164, isValidEmail, normalizePhoneInput } from '@/lib/validate';
import type { Company, Outlet, PermissionsMeta, UserRow } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode; absent → create mode. */
  user?: UserRow | null;
  companies: Company[];
  outlets: Outlet[];
  permissionsMeta?: PermissionsMeta;
}

interface FormErrors {
  email?: string;
  fullName?: string;
  password?: string;
  phoneE164?: string;
}

export function UserFormModal({ open, onClose, user, companies, outlets, permissionsMeta }: Props) {
  const qc = useQueryClient();
  const { push } = useToast();
  const { user: me } = useAuth();
  const isEdit = !!user;

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [scopeCompanyIds, setScopeCompanyIds] = useState<string[]>([]);
  const [scopeOutletIds, setScopeOutletIds] = useState<string[]>([]);
  const [granted, setGranted] = useState<Permission[]>([]);
  const [revoked, setRevoked] = useState<Permission[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  // Re-seed the form whenever the modal opens for a (different) user.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPassword('');
    if (user) {
      setEmail(user.email);
      setFullName(user.fullName);
      setRole(user.role);
      setPhone(user.phoneE164 ?? '');
      setIsActive(user.isActive);
      setScopeCompanyIds(
        (user.scopes ?? []).filter((s) => s.companyId && !s.outletId).map((s) => s.companyId as string),
      );
      setScopeOutletIds((user.scopes ?? []).filter((s) => s.outletId).map((s) => s.outletId as string));
      setGranted(user.grantedPermissions ?? []);
      setRevoked(user.revokedPermissions ?? []);
    } else {
      setEmail('');
      setFullName('');
      setRole('VIEWER');
      setPhone('');
      setIsActive(true);
      setScopeCompanyIds([]);
      setScopeOutletIds([]);
      setGranted([]);
      setRevoked([]);
    }
  }, [open, user]);

  const rolePerms = useMemo(
    () => new Set(permissionsMeta?.rolePermissions?.[role] ?? []),
    [permissionsMeta, role],
  );

  /** All permission keys grouped by `resource` prefix. */
  const permissionGroups = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of permissionsMeta?.permissions ?? []) {
      const resource = p.split(':')[0] ?? p;
      const list = groups.get(resource) ?? [];
      list.push(p);
      groups.set(resource, list);
    }
    return [...groups.entries()];
  }, [permissionsMeta]);

  function isEffective(p: Permission): boolean {
    if (rolePerms.has(p)) return !revoked.includes(p);
    return granted.includes(p);
  }

  function togglePermission(p: Permission) {
    if (rolePerms.has(p)) {
      setRevoked((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));
    } else {
      setGranted((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));
    }
  }

  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!isEdit) {
      if (!email.trim()) next.email = MSG.required;
      else if (!isValidEmail(email)) next.email = MSG.email;
      if (!password) next.password = MSG.required;
      else if (password.length < 8) next.password = MSG.passwordMin;
    }
    if (!fullName.trim()) next.fullName = MSG.required;
    if (phone.trim() && !isValidE164(normalizePhoneInput(phone))) next.phoneE164 = MSG.phone;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const save = useMutation({
    mutationFn: async () => {
      const phoneNorm = phone.trim() ? normalizePhoneInput(phone) : null;
      if (isEdit && user) {
        return apiFetch(`/users/${user.id}`, {
          method: 'PATCH',
          body: {
            fullName: fullName.trim(),
            role,
            isActive,
            phoneE164: phoneNorm,
            grantedPermissions: granted,
            revokedPermissions: revoked,
            scopeCompanyIds,
            scopeOutletIds,
          },
        });
      }
      return apiFetch('/users', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          role,
          password,
          ...(phoneNorm ? { phoneE164: phoneNorm } : {}),
          scopeCompanyIds,
          scopeOutletIds,
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      push({
        tone: 'success',
        title: isEdit ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu',
        body: fullName.trim(),
      });
      onClose();
    },
    onError: (e) => {
      push({ tone: 'danger', title: 'İşlem başarısız', body: (e as Error).message });
    },
  });

  function submit() {
    if (!validate()) return;
    save.mutate();
  }

  // Roles the current actor may assign (mirror of canAssignRole on the API).
  const assignableRoles = useMemo(() => {
    const rank: Record<Role, number> = { OWNER: 5, ADMIN: 4, ACCOUNTANT: 3, MANAGER: 2, VIEWER: 1 };
    const myRank = me ? rank[me.role] : 0;
    return ROLE_OPTIONS.filter((o) =>
      o.value === 'OWNER' ? me?.role === 'OWNER' : rank[o.value] <= myRank,
    );
  }, [me]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}
      subtitle={isEdit ? user?.email : 'Panele erişecek yeni bir kişi ekleyin'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {isEdit ? 'Kaydet' : 'Oluştur'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Account */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-posta">
            <Input
              type="email"
              value={email}
              disabled={isEdit}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kisi@ornek.com"
              autoComplete="off"
            />
            <FieldError message={errors.email} />
          </Field>
          <Field label="Ad Soyad">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" />
            <FieldError message={errors.fullName} />
          </Field>
          <Field label="Rol">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {assignableRoles.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Telefon" hint="Uluslararası biçim: +905321234567">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+90…"
              inputMode="tel"
            />
            <FieldError message={errors.phoneE164} />
          </Field>
          {!isEdit && (
            <Field label="Şifre" hint="En az 8 karakter">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <FieldError message={errors.password} />
            </Field>
          )}
        </div>

        {isEdit && (
          <div className="rounded-xl border border-slate-200 p-4">
            <Switch
              checked={isActive}
              onChange={setIsActive}
              label="Hesap aktif"
              description="Pasif kullanıcılar panele giriş yapamaz."
            />
          </div>
        )}

        {/* Scope */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Erişim Kapsamı</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Hiçbir seçim yapılmazsa kullanıcı tüm firma ve şubelere erişir.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Firmalar</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 scrollbar-thin">
                {companies.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Firma yok.</p>}
                {companies.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                      checked={scopeCompanyIds.includes(c.id)}
                      onChange={() => setScopeCompanyIds((l) => toggleId(l, c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Şubeler</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 scrollbar-thin">
                {outlets.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Şube yok.</p>}
                {outlets.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                      checked={scopeOutletIds.includes(o.id)}
                      onChange={() => setScopeOutletIds((l) => toggleId(l, o.id))}
                    />
                    <span className="min-w-0 truncate">
                      {o.name} <span className="text-xs text-slate-400">· {o.company.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Permissions (edit only — grants/revokes are applied via PATCH) */}
        {isEdit && permissionsMeta && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">İzinler</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {roleLabel(role)} rolünün varsayılan izinleri işaretlidir; rol dışı izinler ek izin,
                  kaldırılanlar istisna olarak kaydedilir.
                </p>
              </div>
              {(granted.length > 0 || revoked.length > 0) && (
                <div className="flex shrink-0 gap-1.5">
                  {granted.length > 0 && <Badge tone="accent">+{granted.length} ek</Badge>}
                  {revoked.length > 0 && <Badge tone="danger">-{revoked.length} kaldırılan</Badge>}
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {permissionGroups.map(([resource, perms]) => (
                <div key={resource} className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {permissionResourceLabel(resource)}
                  </p>
                  <div className="space-y-0.5">
                    {perms.map((p) => {
                      const isDefault = rolePerms.has(p);
                      const checked = isEffective(p);
                      const isGrant = !isDefault && checked;
                      const isRevoke = isDefault && !checked;
                      return (
                        <label
                          key={p}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-slate-50',
                            isGrant && 'text-sky-700',
                            isRevoke && 'text-red-600 line-through decoration-red-300',
                            !isGrant && !isRevoke && 'text-slate-700',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                            checked={checked}
                            onChange={() => togglePermission(p)}
                          />
                          <span className="flex-1">{permissionActionLabel(p)}</span>
                          {isDefault && !isRevoke && (
                            <span className="text-[10px] font-medium uppercase text-slate-300">rol</span>
                          )}
                          {isGrant && <span className="text-[10px] font-medium uppercase text-sky-500">ek</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!isEdit && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Rol dışı ek izinleri, kullanıcıyı oluşturduktan sonra <strong>Düzenle</strong> ekranından
            verebilirsiniz.
          </p>
        )}
      </div>
    </Modal>
  );
}

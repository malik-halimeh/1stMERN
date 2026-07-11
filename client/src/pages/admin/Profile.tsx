import { useState } from 'react';
import { User as UserIcon, Mail, ShieldCheck, Save, KeyRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

/**
 * Profile Settings for staff accounts (inventory managers & super admins).
 * Name is editable via PATCH /auth/profile — email and role are read-only
 * (role changes must go through the audited super-admin Users page).
 */
const AdminProfile = () => {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  const isDirty = name.trim() !== (user?.name || '') && name.trim().length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;

    setIsSaving(true);
    try {
      const res = await api.patch('/auth/profile', { name: name.trim() });
      if (res.data?.success) {
        setUser((prev) => (prev ? { ...prev, name: res.data.data.name } : prev));
        addToast('Profile name updated.', 'success');
      }
    } catch (err) {
      addToast(getApiErrorMessage(err, 'Failed to update profile.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-h1 font-bold text-primary-dark">Profile Settings</h1>
        <p className="mt-1 text-text-secondary">Update your admin account details.</p>
      </div>

      {/* Identity card */}
      <div className="bg-surface border border-dashboard-section-bg rounded-card shadow-level1 p-6 flex items-center gap-4">
        <span className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-level1 flex-shrink-0 select-none">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="text-section-title-sm font-semibold text-text-primary truncate">
            {user?.name}
          </p>
          <p className="text-secondary text-text-secondary flex items-center gap-1.5 truncate">
            <Mail className="h-3.5 w-3.5 text-text-muted flex-shrink-0" /> {user?.email}
          </p>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <ShieldCheck className="h-3 w-3" /> {user?.role.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Editable details */}
      <form
        onSubmit={handleSave}
        className="bg-surface border border-dashboard-section-bg rounded-card shadow-level1 p-6 space-y-5"
      >
        <h2 className="text-section-title-sm font-semibold text-text-primary flex items-center gap-2">
          <UserIcon className="h-4.5 w-4.5 text-primary" /> Account Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="profile-name"
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            id="profile-email"
            label="Email (read-only)"
            value={user?.email || ''}
            disabled
            readOnly
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-caption text-text-muted">
            Your role is managed by a super admin on the Users page.
          </p>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            disabled={!isDirty}
            icon={<Save className="h-4 w-4" />}
          >
            Save changes
          </Button>
        </div>
      </form>

      {/* Password guidance — there is deliberately no in-session password
          change endpoint; the email-code reset flow proves inbox ownership */}
      <div className="bg-surface border border-dashboard-section-bg rounded-card shadow-level1 p-6">
        <h2 className="text-section-title-sm font-semibold text-text-primary flex items-center gap-2 mb-2">
          <KeyRound className="h-4.5 w-4.5 text-primary" /> Password
        </h2>
        <p className="text-secondary text-text-secondary">
          To change your password, sign out and use{' '}
          <span className="font-semibold text-text-primary">“Forgot password?”</span> on the login
          page — a 6-digit verification code will be emailed to{' '}
          <span className="font-mono text-caption">{user?.email}</span> to confirm it's you.
        </p>
      </div>
    </div>
  );
};

export default AdminProfile;

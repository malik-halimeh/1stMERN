import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

interface Address {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    country: string;
    isDefault: boolean;
}

type UserRole = "customer" | "inventory_manager" | "super_admin";

interface User {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    addresses: Address[];
    createdAt: string;
}

interface UserForm {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    isActive: boolean;
}

const EMPTY_FORM: UserForm = {
    name: "",
    email: "",
    password: "",
    role: "customer",
    isActive: true,
};

const inputClass =
    "w-full rounded-input border border-text-disabled bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary";

const Users = () => {
    const { user: me } = useAuth();
    const { addToast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form, setForm] = useState<UserForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get("/users?limit=100");
            setUsers(res.data.data);
        } catch (err) {
            console.error("Failed to fetch users:", err);
            addToast("Failed to load users.", "error");
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const openCreate = () => {
        setEditingUser(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    const openEdit = (u: User) => {
        setEditingUser(u);
        setForm({
            name: u.name,
            email: u.email,
            password: "",
            role: u.role,
            isActive: u.isActive,
        });
        setModalOpen(true);
    };

    // Role and status changes go through the dedicated audited endpoints,
    // not the general update — the edit modal only covers name/email/password
    const handleChangeRole = async (u: User, role: UserRole) => {
        if (role === u.role) return;
        if (!window.confirm(`Change ${u.name}'s role from ${u.role} to ${role}?`)) return;
        try {
            await api.patch(`/users/${u._id}/role`, { role });
            addToast(`${u.name} is now ${role}.`, "success");
            await fetchUsers();
        } catch (err: any) {
            addToast(err.response?.data?.message || "Failed to change role.", "error");
        }
    };

    const handleToggleStatus = async (u: User) => {
        const next = !u.isActive;
        if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${u.name}'s account?`)) return;
        try {
            await api.patch(`/users/${u._id}/status`, { isActive: next });
            addToast(`${u.name} ${next ? "activated" : "deactivated"}.`, "success");
            await fetchUsers();
        } catch (err: any) {
            addToast(err.response?.data?.message || "Failed to change status.", "error");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editingUser) {
                const payload: Partial<UserForm> = {
                    name: form.name,
                    email: form.email,
                };
                if (form.password) payload.password = form.password;
                await api.put(`/users/${editingUser._id}`, payload);
                addToast(`User ${form.name} updated.`, "success");
            } else {
                await api.post("/users", form);
                addToast(`User ${form.name} created.`, "success");
            }
            setModalOpen(false);
            await fetchUsers();
        } catch (err: any) {
            const data = err.response?.data;
            const detail = data?.details?.[0];
            const message = detail
                ? `${detail.field}: ${detail.message}`
                : data?.message || data?.error?.message || "Failed to save user.";
            addToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (u: User) => {
        if (!window.confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) {
            return;
        }
        setDeletingId(u._id);
        try {
            await api.delete(`/users/${u._id}`);
            addToast(`User ${u.name} deleted.`, "success");
            await fetchUsers();
        } catch (err: any) {
            const message =
                err.response?.data?.message ||
                err.response?.data?.error?.message ||
                "Failed to delete user.";
            addToast(message, "error");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-text-primary">Users</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Manage platform accounts and role assignments.
                    </p>
                </div>
                <Button variant="primary" onClick={openCreate}>
                    Add User
                </Button>
            </div>

            {/* Table Card */}
            <div className="rounded-xl border border-dashboard-section-bg bg-surface shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-dashboard-section-bg">
                    <h2 className="font-medium text-text-primary">All Users</h2>
                    <span className="text-sm text-text-secondary">{users.length} accounts</span>
                </div>

                {loading ? (
                    <div className="p-6 space-y-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="h-12 rounded-lg bg-background animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-dashboard-section-bg bg-background">
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Name</th>
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Email</th>
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Role</th>
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Status</th>
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Addresses</th>
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Created</th>
                                    <th className="px-6 py-3 text-left font-medium text-text-secondary">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr
                                            key={user._id}
                                            className="border-b border-dashboard-section-bg last:border-none hover:bg-background/60 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-text-primary">
                                                    {user.name}
                                                    {me?.id === user._id && (
                                                        <span className="ml-2 text-[10px] font-bold uppercase text-text-muted">
                                                            (you)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                                            <td className="px-6 py-4">
                                                {me?.id === user._id ? (
                                                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                                        {user.role}
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) =>
                                                            handleChangeRole(user, e.target.value as UserRole)
                                                        }
                                                        className="rounded-input border border-text-disabled bg-surface px-2 py-1 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                                    >
                                                        <option value="customer">customer</option>
                                                        <option value="inventory_manager">inventory_manager</option>
                                                        <option value="super_admin">super_admin</option>
                                                    </select>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleStatus(user)}
                                                    disabled={me?.id === user._id}
                                                    title={
                                                        me?.id === user._id
                                                            ? "You cannot deactivate your own account"
                                                            : user.isActive
                                                                ? "Click to deactivate"
                                                                : "Click to activate"
                                                    }
                                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity disabled:cursor-not-allowed ${
                                                        user.isActive
                                                            ? "bg-green-500/10 text-green-600 hover:opacity-70"
                                                            : "bg-red-500/10 text-red-600 hover:opacity-70"
                                                    }`}
                                                >
                                                    {user.isActive ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary">{user.addresses.length}</td>
                                            <td className="px-6 py-4 text-text-secondary">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openEdit(user)}
                                                        className="text-xs font-semibold text-primary hover:text-primary-dark"
                                                    >
                                                        Edit
                                                    </button>
                                                    {me?.id !== user._id && (
                                                        <button
                                                            onClick={() => handleDelete(user)}
                                                            disabled={deletingId === user._id}
                                                            className="text-xs font-semibold text-danger hover:text-red-800 disabled:opacity-50"
                                                        >
                                                            {deletingId === user._id ? "Deleting…" : "Delete"}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create / Edit modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingUser ? `Edit ${editingUser.name}` : "Add User"}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : editingUser ? "Save Changes" : "Create User"}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-label text-text-secondary mb-1">Name</label>
                        <input
                            className={inputClass}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Full name"
                        />
                    </div>
                    <div>
                        <label className="block text-label text-text-secondary mb-1">Email</label>
                        <input
                            type="email"
                            className={inputClass}
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-label text-text-secondary mb-1">
                            {editingUser ? "New password (leave blank to keep current)" : "Password"}
                        </label>
                        <input
                            type="password"
                            className={inputClass}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="Min 8 chars, 1 uppercase, 1 number"
                        />
                    </div>
                    {editingUser ? (
                        <p className="text-caption text-text-muted">
                            Role and account status are changed from the table row — those
                            changes are audit-logged.
                        </p>
                    ) : (
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-label text-text-secondary mb-1">Role</label>
                                <select
                                    className={inputClass}
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                                >
                                    <option value="customer">customer</option>
                                    <option value="inventory_manager">inventory_manager</option>
                                    <option value="super_admin">super_admin</option>
                                </select>
                            </div>
                            <div className="flex items-end pb-2">
                                <label className="flex items-center gap-2 text-sm text-text-secondary select-none cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                        className="h-4 w-4 accent-primary"
                                    />
                                    Active
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Users;

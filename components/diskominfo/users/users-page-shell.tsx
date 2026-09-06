"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  ManagedUser,
  OpdOption,
  UserFilters,
  WilayahOption,
} from "@/lib/diskominfo/users";

import { AddUserDialog } from "./add-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import { UserFiltersForm } from "./user-filters";
import { UserPagination } from "./user-pagination";
import { UserTable } from "./user-table";
import styles from "./users.module.css";

type UsersPageShellProps = {
  filters: UserFilters;
  result: {
    users: ManagedUser[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  opdOptions: OpdOption[];
  wilayahOptions: WilayahOption[];
};

export function UsersPageShell({
  filters,
  result,
  opdOptions,
  wilayahOptions,
}: UsersPageShellProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  function handleSuccess(message: string) {
    setShowAdd(false);
    setEditingUser(null);
    setSuccessMessage(message);
    router.refresh();
  }

  const hasFilters = Boolean(
    filters.search || filters.opdId || filters.wilayahId,
  );

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <h1 id="users-heading">Manajemen Pengguna</h1>
          <p>
            Akun lapangan (Kelurahan/Kecamatan) wajib memiliki wilayah
            penugasan.
          </p>
        </div>

        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => {
            setSuccessMessage("");
            setShowAdd(true);
          }}
        >
          Tambah Akun
        </button>
      </header>

      {successMessage ? (
        <div className={styles.successBanner} role="status">
          {successMessage}
        </div>
      ) : null}

      <UserFiltersForm
        filters={filters}
        opdOptions={opdOptions}
        wilayahOptions={wilayahOptions}
      />

      <div className={styles.tableCard}>
        <UserTable
          users={result.users}
          hasFilters={hasFilters}
          onEdit={(user) => {
            setSuccessMessage("");
            setEditingUser(user);
          }}
        />

        <UserPagination
          filters={filters}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          totalPages={result.totalPages}
        />
      </div>

      <AddUserDialog
        open={showAdd}
        opdOptions={opdOptions}
        wilayahOptions={wilayahOptions}
        onClose={() => setShowAdd(false)}
        onSuccess={() => handleSuccess("Akun berhasil dibuat.")}
      />

      <EditUserDialog
        user={editingUser}
        opdOptions={opdOptions}
        wilayahOptions={wilayahOptions}
        onClose={() => setEditingUser(null)}
        onSuccess={() =>
          handleSuccess("Perubahan akun berhasil disimpan.")
        }
      />
    </>
  );
}

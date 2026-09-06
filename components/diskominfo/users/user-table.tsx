"use client";

import { getUserRoleLabel } from "@/lib/diskominfo/user-role-config";
import type { ManagedUser } from "@/lib/diskominfo/users";

import styles from "./users.module.css";

type UserTableProps = {
  users: ManagedUser[];
  hasFilters: boolean;
  onEdit: (user: ManagedUser) => void;
};

function getInstansiLabel(user: ManagedUser) {
  if (user.opdNama) {
    return user.opdNama;
  }

  if (user.wilayahNama && user.wilayahJenis) {
    return `${user.wilayahJenis === "KECAMATAN" ? "Kecamatan" : "Kelurahan"} ${user.wilayahNama}`;
  }

  return user.instansi || "—";
}

function getWilayahLabel(user: ManagedUser) {
  if (user.wilayahNama) {
    return user.wilayahNama;
  }

  if (user.wilayahLegacy && user.wilayahLegacy !== "- Semua Wilayah -") {
    return user.wilayahLegacy;
  }

  return user.role === "Admin Diskominfo" ? "Semua Wilayah" : "—";
}

function UserStatus({ status }: { status: ManagedUser["status"] }) {
  return (
    <span
      className={`${styles.statusBadge} ${
        status === "AKTIF" ? styles.statusActive : styles.statusInactive
      }`}
    >
      {status}
    </span>
  );
}

export function UserTable({ users, hasFilters, onEdit }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className={styles.emptyState}>
        {hasFilters
          ? "Tidak ada pengguna yang sesuai dengan filter."
          : "Belum ada akun pengguna."}
      </div>
    );
  }

  return (
    <>
      <div className={styles.desktopTable}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nama Pengguna</th>
              <th>Instansi/OPD</th>
              <th>Role</th>
              <th>Wilayah/Region</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong className={styles.userName}>{user.namaLengkap}</strong>
                  <span className={styles.userEmail}>{user.email}</span>
                </td>
                <td>{getInstansiLabel(user)}</td>
                <td>{getUserRoleLabel(user.role)}</td>
                <td>{getWilayahLabel(user)}</td>
                <td>
                  <UserStatus status={user.status} />
                </td>
                <td>
                  <button
                    className={styles.editButton}
                    type="button"
                    aria-label={`Edit akun ${user.namaLengkap}`}
                    onClick={() => onEdit(user)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileCards}>
        {users.map((user) => (
          <article className={styles.userCard} key={user.id}>
            <div className={styles.userCardHeader}>
              <div>
                <h2>{user.namaLengkap}</h2>
                <p>{user.email}</p>
              </div>
              <UserStatus status={user.status} />
            </div>

            <dl className={styles.userDetails}>
              <div>
                <dt>Instansi/OPD</dt>
                <dd>{getInstansiLabel(user)}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{getUserRoleLabel(user.role)}</dd>
              </div>
              <div>
                <dt>Wilayah</dt>
                <dd>{getWilayahLabel(user)}</dd>
              </div>
            </dl>

            <button
              className={styles.mobileEditButton}
              type="button"
              aria-label={`Edit akun ${user.namaLengkap}`}
              onClick={() => onEdit(user)}
            >
              Edit
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

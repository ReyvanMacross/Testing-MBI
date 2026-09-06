import { UsersPageShell } from "@/components/diskominfo/users/users-page-shell";
import {
  getManagedUsers,
  getMasterOpdOptions,
  getWilayahOptions,
} from "@/lib/diskominfo/users";

import styles from "./pengguna.module.css";

type PenggunaPageProps = {
  searchParams: Promise<{
    q?: string;
    opd?: string;
    wilayah?: string;
    page?: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PenggunaPage({ searchParams }: PenggunaPageProps) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const filters = {
    search:
      params.q && params.q.trim().length <= 100
        ? params.q.trim()
        : undefined,
    opdId:
      params.opd && UUID_PATTERN.test(params.opd) ? params.opd : undefined,
    wilayahId:
      params.wilayah && UUID_PATTERN.test(params.wilayah)
        ? params.wilayah
        : undefined,
    page:
      Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };

  const [result, opdOptions, wilayahOptions] = await Promise.all([
    getManagedUsers(filters),
    getMasterOpdOptions(),
    getWilayahOptions(),
  ]);

  return (
    <section className={styles.page} aria-labelledby="users-heading">
      <UsersPageShell
        filters={filters}
        result={result}
        opdOptions={opdOptions}
        wilayahOptions={wilayahOptions}
      />
    </section>
  );
}

import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsJson,
  parseAsString,
} from "nuqs/server";
import { listEmployeesPage } from "@/lib/queries";
import {
  EMPLOYEE_STATUS_LABEL,
  EMPLOYEE_STATUS_TONE,
} from "@/lib/labels";
import { PageHeader } from "@/components/ui";
import { AddEmployeeDrawer } from "@/components/add-employee-drawer";
import {
  EmployeesTable,
  type EmployeeRow,
} from "@/components/employees-table";
import { isExtendedColumnFilterArray } from "@/lib/data-table";
import type { ExtendedColumnFilter } from "@/types/data-table";

const searchParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  sort: parseAsString,
  filters: parseAsJson<ExtendedColumnFilter[]>((value) =>
    isExtendedColumnFilterArray(value) ? value : null,
  ),
});

export default async function EmployeesPage({
  searchParams,
}: PageProps<"/employees">) {
  const params = searchParamsCache.parse(await searchParams);
  const { data, pageCount } = await listEmployeesPage(params);

  const rows: EmployeeRow[] = data.map((e) => ({
    id: e.id,
    name: e.name,
    position: e.position,
    phone: e.phone ?? "—",
    zalo: Boolean(e.zaloUserId),
    open: Number(e.open),
    status: e.status,
    statusLabel: EMPLOYEE_STATUS_LABEL[e.status],
    statusTone: EMPLOYEE_STATUS_TONE[e.status],
  }));

  return (
    <div>
      <PageHeader
        title="Nhân viên"
        description="Danh sách nhân viên và trạng thái kết nối Zalo."
        action={<AddEmployeeDrawer />}
      />

      <EmployeesTable data={rows} pageCount={pageCount} />
    </div>
  );
}

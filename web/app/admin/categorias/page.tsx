import CategoriasTable from '@/components/admin/CategoriasTable';
import { getCategories } from '@/lib/queries';

export default async function AdminCategoriasPage() {
  const items = await getCategories();
  return <CategoriasTable items={items} />;
}

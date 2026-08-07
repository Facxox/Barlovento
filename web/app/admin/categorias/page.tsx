import CategoriasTable, { type CategoryActions } from '@/components/admin/CategoriasTable';
import { getCategories } from '@/lib/queries';
import {
  upsertCategory,
  deleteCategory,
  toggleCategoryActive,
  moveCategory,
} from '@/lib/admin-actions';

export default async function AdminCategoriasPage() {
  const items = await getCategories();
  const actions: CategoryActions = {
    upsert: upsertCategory,
    remove: deleteCategory,
    toggle: toggleCategoryActive,
    move: moveCategory,
  };
  return (
    <CategoriasTable
      items={items}
      title="Categorías de producto"
      emptyMessage="No hay categorías de producto todavía."
      actions={actions}
    />
  );
}

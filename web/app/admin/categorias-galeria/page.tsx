import CategoriasTable, { type CategoryActions } from '@/components/admin/CategoriasTable';
import { getGalleryCategories } from '@/lib/queries';
import {
  upsertGalleryCategory,
  deleteGalleryCategory,
  toggleGalleryCategoryActive,
  moveGalleryCategory,
} from '@/lib/admin-actions';

export default async function AdminCategoriasGaleriaPage() {
  const items = await getGalleryCategories();
  const actions: CategoryActions = {
    upsert: upsertGalleryCategory,
    remove: deleteGalleryCategory,
    toggle: toggleGalleryCategoryActive,
    move: moveGalleryCategory,
  };
  return (
    <CategoriasTable
      items={items}
      title="Categorías de galería"
      emptyMessage="No hay categorías de galería todavía."
      actions={actions}
    />
  );
}

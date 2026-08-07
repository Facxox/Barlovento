import { getServerSupabase } from '@/lib/supabase-server';
import GaleriaGrid from '@/components/admin/GaleriaGrid';
import galleryJson from '@/data/gallery.json';
import type { GalleryItem } from '@/lib/queries';
import { getGalleryCategories } from '@/lib/queries';

async function listAllGallery(): Promise<GalleryItem[]> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return [...(galleryJson as GalleryItem[])].sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as GalleryItem[];
}

export default async function AdminGaleriaPage() {
  const [items, categories] = await Promise.all([
    listAllGallery(),
    getGalleryCategories(),
  ]);
  return <GaleriaGrid items={items} categories={categories} />;
}

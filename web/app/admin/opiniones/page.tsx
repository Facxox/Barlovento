import OpinionesAdmin from '@/components/admin/OpinionesAdmin';
import { listAllReviewsForAdmin } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Opiniones · Admin Barlovento' };

export default async function AdminOpinionesPage() {
  const reviews = await listAllReviewsForAdmin();
  return <OpinionesAdmin initial={reviews} />;
}

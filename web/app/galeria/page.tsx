import { redirect } from 'next/navigation';

// /galeria sola no tiene contenido propio: mandamos a la sección de la home.
export default function GaleriaIndex() {
  redirect('/#galeria');
}

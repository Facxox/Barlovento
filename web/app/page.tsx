import Hero from '@/components/Hero';
import Historia from '@/components/Historia';
import MisionVision from '@/components/MisionVision';
import Valores from '@/components/Valores';
import PuntosVenta from '@/components/PuntosVenta';
import TiendaServer from '@/components/TiendaServer';
import Eventos from '@/components/Eventos';
import RegalosEmpresariales from '@/components/RegalosEmpresariales';
import GaleriaServer from '@/components/GaleriaServer';
import ContactoServer from '@/components/ContactoServer';

export default function Home() {
  return (
    <>
      <Hero />
      <Historia />
      <MisionVision />
      <Valores />
      <PuntosVenta />
      <TiendaServer />
      <Eventos />
      <RegalosEmpresariales />
      <GaleriaServer />
      <ContactoServer />
    </>
  );
}

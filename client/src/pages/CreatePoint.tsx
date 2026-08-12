import { CreateWizard } from "../components/create/CreateWizard";

// Página /crear: delega en el asistente.
// El asistente renderiza el mapa a pantalla completa de fondo con un drawer
// inferior (móvil) / panel lateral derecho (desktop) que guía la creación por pasos.
export function CreatePoint() {
  return <CreateWizard />;
}

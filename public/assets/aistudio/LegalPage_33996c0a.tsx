import {ArrowLeft, FileText, ShieldCheck} from 'lucide-react';
import {OFFICIAL_LOGO_PATH} from '../utils/thermalPrint';

export type LegalDocType = 'privacidad' | 'terminos';

interface LegalPageProps {
  docType: LegalDocType;
  onNavigateDoc: (doc: LegalDocType) => void;
  onBack: () => void;
}

export function LegalPage({docType, onNavigateDoc, onBack}: LegalPageProps) {
  const isPrivacy = docType === 'privacidad';

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 py-6 px-4 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-teal-600" />
            <span>Volver al inicio</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateDoc('privacidad')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isPrivacy
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacidad</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateDoc('terminos')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                !isPrivacy
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Términos</span>
            </button>
          </div>
        </div>

        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-12 h-10 rounded-xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center shrink-0">
              <img
                src={OFFICIAL_LOGO_PATH}
                alt="TECH"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {isPrivacy ? 'Política de Privacidad' : 'Términos de Servicio'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Última actualización: 19 de noviembre de 2026 · TECH — Servicio Técnico Especializado
              </p>
            </div>
          </div>

          {isPrivacy ? (
            <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <p>
                En <strong>TECH — Servicio Técnico Especializado</strong> respetamos tu privacidad y protegemos los datos de tu negocio. Esta política explica qué información recopilamos, cómo la almacenamos y cuáles son tus derechos al utilizar la aplicación web.
              </p>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  1. Datos de inicio de sesión con Google
                </h2>
                <p>
                  Si elegís iniciar sesión con Google mediante Firebase Authentication, solicitamos únicamente los permisos básicos de identidad (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">openid</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">email</code> y <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">profile</code>) para mostrarte tu nombre, correo electrónico y foto de perfil, y asociar tus registros a tu cuenta privada. No solicitamos acceso a tu Google Drive, Gmail, Contactos ni otros servicios personales.
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  2. Datos operativos almacenados
                </h2>
                <p>
                  Los datos de inventario, órdenes de reparación e historial de ventas que cargues en la aplicación se almacenan exclusivamente en tu espacio privado de Cloud Firestore (cuando iniciás sesión con Google) o localmente en tu dispositivo/navegador (cuando usás el Modo Invitado).
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  3. Permiso de cámara
                </h2>
                <p>
                  La aplicación puede solicitar acceso a la cámara de tu dispositivo únicamente cuando activás el lector de códigos de barras/QR. Las imágenes de la cámara se procesan en tiempo real dentro de tu navegador y nunca se graban, suben ni comparten con terceros.
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  4. Uso, compartición y seguridad
                </h2>
                <ul className="list-disc pl-5 space-y-1">
                  <li>No vendemos, alquilamos ni cedemos tus datos comerciales o personales a terceros.</li>
                  <li>Cada usuario autenticado solo puede leer y modificar los documentos vinculados a su propio identificador (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">uid</code>), protegidos mediante reglas de seguridad de Firestore.</li>
                  <li>Podés descargar una copia completa de tus datos en formato JSON o cerrar sesión limpiando el almacenamiento local en cualquier momento.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">5. Contacto</h2>
                <p>
                  Para consultas sobre privacidad, eliminación de datos o soporte técnico, escribinos a{' '}
                  <a
                    href="mailto:jo4quinpalavecino@gmail.com"
                    className="text-teal-700 font-semibold hover:underline"
                  >
                    jo4quinpalavecino@gmail.com
                  </a>
                  .
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  1. Aceptación de los términos
                </h2>
                <p>
                  Al acceder o utilizar <strong>TECH — Servicio Técnico Especializado</strong> aceptás estos Términos de Servicio. La aplicación ofrece herramientas para la administración de inventario, órdenes de taller, punto de venta, emisión de comprobantes y exportación de reportes.
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  2. Cuentas de usuario y Modo Invitado
                </h2>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Podés operar mediante <strong>Modo Invitado</strong> (almacenamiento local en el dispositivo) o iniciar sesión con <strong>Google</strong> para sincronizar tus datos en tu base privada de Cloud Firestore.
                  </li>
                  <li>
                    Sos responsable de mantener la confidencialidad de tu cuenta de Google y de los dispositivos desde los cuales accedés.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  3. Respaldo de la información
                </h2>
                <p>
                  Aunque la plataforma ofrece sincronización en la nube y exportación manual de copias de seguridad en formato JSON y Excel, te recomendamos descargar copias periódicas de respaldo de tus registros comerciales.
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  4. Uso permitido
                </h2>
                <p>
                  Te comprometés a utilizar la aplicación de forma lícita y sin intentar vulnerar las reglas de seguridad, acceder a datos de otros usuarios ni interferir con la disponibilidad del servicio.
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">
                  5. Limitación de responsabilidad
                </h2>
                <p>
                  La aplicación se proporciona &quot;tal cual está&quot;, sin garantías implícitas de disponibilidad ininterrumpida. El titular del servicio no será responsable por pérdidas indirectas derivadas del uso de datos locales en Modo Invitado o fallas de conectividad externas.
                </p>
              </section>

              <section className="space-y-1.5">
                <h2 className="text-base font-bold text-teal-800">6. Contacto</h2>
                <p>
                  Para consultas sobre estos términos, comunicate a{' '}
                  <a
                    href="mailto:jo4quinpalavecino@gmail.com"
                    className="text-teal-700 font-semibold hover:underline"
                  >
                    jo4quinpalavecino@gmail.com
                  </a>
                  .
                </p>
              </section>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

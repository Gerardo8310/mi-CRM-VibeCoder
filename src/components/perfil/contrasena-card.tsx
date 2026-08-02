"use client";

import { useState, type ReactNode } from "react";
import { useAction, useQuery } from "convex/react";
import { AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import { MIN_PASSWORD_LENGTH } from "@convex/authConstants";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PerfilCard } from "@/components/perfil/perfil-card";
import { MedidorFortaleza } from "@/components/perfil/medidor-fortaleza";

/**
 * "Contraseña" (GER-49). Ver Design/PerfilUsuario.dc.html, sección 2.
 *
 * DOS COSAS QUE PARECEN DETALLES Y SON REQUISITOS
 *
 * 1. **Un fallo NO borra lo escrito.** Es criterio de aceptación explícito del
 *    issue: quien se equivoca en la contraseña actual no debería tener que
 *    reescribir las otras dos. Por eso los campos solo se vacían al acertar.
 * 2. **El error tiene que decir cuál fue.** Como en producción Convex redacta el
 *    texto de las excepciones, `changePassword` devuelve el motivo como valor en
 *    vez de lanzarlo, y aquí se traduce a un mensaje concreto. Sin eso, todo
 *    fallo se vería igual: "Server Error".
 *
 * EL AVISO SOBRE LAS OTRAS SESIONES DICE LO QUE DE VERDAD PASA. Ver el
 * comentario junto a `invalidateSessions` en convex/passwordChange.ts: la sesión
 * ajena se borra al instante, pero su JWT ya emitido sigue valiendo hasta 15
 * minutos. Prometer "se cierra la sesión en tus otros dispositivos" a secas
 * sería prometer algo que el sistema no cumple.
 */

/** Campo de contraseña con el ojo de mostrar/ocultar de la maqueta. */
function CampoContrasena({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  error,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  disabled?: boolean;
  error?: boolean;
  children?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-4">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          error={error}
          className="pr-10.5"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // SÍ entra en el recorrido del tabulador. Lo tuvo excluido y era un
          // error: es un botón de verdad, y lo que hace —enseñar en claro una
          // contraseña— es justo lo que alguien que no usa ratón necesita poder
          // decidir. Dejarlo fuera lo volvía inalcanzable para quien más lo
          // necesita, a cambio de ahorrar una pulsación a quien no lo usa.
          //
          // Y hacerlo alcanzable obliga a lo otro dos: `aria-pressed` y una
          // etiqueta que cambie —con una fija, un lector de pantalla no puede
          // saber si la contraseña está a la vista— y un estilo de foco visible,
          // porque antes solo había `hover`, que no le sirve a quien navega con
          // teclado. Tabulable sin foco visible es media corrección.
          aria-pressed={visible}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-0 top-0 flex h-full w-10.5 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      {children}
    </div>
  );
}

export function ContrasenaCard({
  /**
   * Recibe el resultado al cambiarla y `null` en cuanto se vuelve a intentar.
   * Los dos sentidos hacen falta: si solo avisara del éxito, el aviso verde
   * seguiría puesto mientras se teclea otra contraseña, dando por guardado algo
   * que aún no se ha enviado.
   *
   * `sesionesCerradas: false` NO es un fallo del cambio: la contraseña cambió,
   * pero las otras sesiones pueden seguir abiertas. Lo decide el servidor.
   */
  onExito,
}: {
  onExito: (resultado: { sesionesCerradas: boolean } | null) => void;
}) {
  const changePassword = useAction(api.passwordChange.changePassword);
  /**
   * El estado llega del servidor ANTES de pintar nada (cierre del hallazgo M2).
   *
   * `undefined` = cargando · `null` = sin sesión utilizable · `false` = no tiene
   * contraseña que cambiar · `true` = sí la tiene. La regla no se calcula aquí:
   * la resuelve `tieneContrasenaElegida` en convex/passwordChange.ts, que es su
   * único dueño.
   */
  const estado = useQuery(api.passwordChange.estadoContrasena);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Se distingue del resto porque la maqueta marca en rojo el campo de la
  // contraseña actual, no los otros dos.
  const [falloEnActual, setFalloEnActual] = useState(false);
  /**
   * La acción respondió `sin-contrasena`. **No es redundante con `estado`**: son
   * dos transacciones distintas, así que esto cubre la carrera —alguien elige su
   * contraseña en otra pestaña mientras esta sigue abierta— y deja constancia
   * visible si alguien llamara a la acción saltándose la pantalla.
   */
  const [falloSinContrasena, setFalloSinContrasena] = useState(false);

  const completo =
    actual.length > 0 && nueva.length > 0 && confirmar.length > 0;

  async function cambiar() {
    if (enviando || !completo) return;
    // Se retira el aviso verde del intento anterior antes de nada.
    onExito(null);

    // Esta comprobación es solo del cliente y no tiene contraparte en el
    // servidor a propósito: "confirmar" no es un dato que el servidor necesite,
    // es una defensa contra la errata de quien escribe. Mandarlo sería pedirle
    // al servidor que valide un campo que no usa para nada.
    if (nueva !== confirmar) {
      setFalloEnActual(false);
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }

    setEnviando(true);
    setError(null);
    setFalloEnActual(false);
    try {
      const r = await changePassword({
        currentPassword: actual,
        newPassword: nueva,
      });

      if (r.ok) {
        // Solo al acertar se vacían los campos.
        setActual("");
        setNueva("");
        setConfirmar("");
        onExito({ sesionesCerradas: r.sesionesCerradas });
        return;
      }

      switch (r.motivo) {
        case "actual-incorrecta":
          setFalloEnActual(true);
          setError("Contraseña actual incorrecta. Verifica e intenta de nuevo.");
          break;
        case "demasiados-intentos":
          // No es lo mismo que fallar la contraseña, y decirlo importa: este
          // camino comparte el límite de intentos con el inicio de sesión, así
          // que aquí ya no sirve ni la contraseña correcta.
          setError(
            "Demasiados intentos fallidos. Espera un rato antes de volver a probar."
          );
          break;
        case "igual-a-la-actual":
          setError("La contraseña nueva tiene que ser distinta de la actual.");
          break;
        case "sin-contrasena":
          setFalloSinContrasena(true);
          break;
        case "politica":
          // El texto viene del servidor, que es quien tiene la política.
          setError(r.mensaje);
          break;
      }
    } catch {
      setError("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  // Sin sesión utilizable no hay nada que ofrecer; `SessionGuard` ya está
  // llevando a /login. Se distingue de `false` a propósito: confundirlos haría
  // parpadear "no tienes contraseña" justo al cerrar sesión.
  if (estado === null) return null;

  // Mientras el servidor responde NO se pinta el formulario. Enseñarlo y
  // sustituirlo después por la explicación sería pedirle a alguien que empiece a
  // escribir algo que no puede hacer.
  if (estado === undefined) {
    return (
      <PerfilCard titulo="Contraseña" subtitulo="Actualiza tu contraseña periódicamente">
        <div className="h-40 animate-pulse bg-neutral-100" />
      </PerfilCard>
    );
  }

  if (!estado || falloSinContrasena) {
    return (
      <PerfilCard titulo="Contraseña" subtitulo="Actualiza tu contraseña periódicamente">
        <p className="text-[13px] leading-relaxed text-neutral-600">
          Todavía no has elegido una contraseña: entraste con Google. Para crear
          una, cierra sesión y en la pantalla de entrada escribe tu correo — te
          mandaremos un código para elegirla.
        </p>
      </PerfilCard>
    );
  }

  return (
    <PerfilCard titulo="Contraseña" subtitulo="Actualiza tu contraseña periódicamente">
      {error && (
        // `role="alert"` porque este banner APARECE tras enviar. Sin región
        // viva, quien usa lector de pantalla no se entera de que ha fallado
        // nada: el foco sigue donde estaba y nada se anuncia.
        <div
          role="alert"
          className="mb-3.5 flex items-center gap-2 border border-error-500/25 bg-error-100 px-3.5 py-2.5"
        >
          <AlertCircle className="size-3.5 shrink-0 text-error-500" />
          <span className="text-[13px] text-error-700">{error}</span>
        </div>
      )}

      {/*
        Es un <form> de verdad, y no tres campos sueltos con un botón, por dos
        cosas que se pierden sin él: Enter no envía —en un formulario de
        contraseñas es lo que todo el mundo hace— y los gestores de contraseñas
        se apoyan en la semántica de formulario para ofrecer guardar la nueva.
        Los `autoComplete` de los campos ya declaran esa intención; sin el
        <form> quedaban a medias.
      */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void cambiar();
        }}
      >
        <CampoContrasena
          id="perfil-actual"
          label="Contraseña actual"
          value={actual}
          onChange={setActual}
          placeholder="Tu contraseña actual"
          autoComplete="current-password"
          disabled={enviando}
          error={falloEnActual}
        >
          {falloEnActual && (
            <p className="mt-1 flex items-center gap-1 text-xs text-error-500">
              <AlertCircle className="size-2.75" />
              Contraseña incorrecta
            </p>
          )}
        </CampoContrasena>

        <CampoContrasena
          id="perfil-nueva"
          label="Nueva contraseña"
          value={nueva}
          onChange={setNueva}
          // El número sale de la constante que aplica el servidor, no de la
          // maqueta, que se quedó en 8 cuando la política subió a 10.
          placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          autoComplete="new-password"
          disabled={enviando}
        >
          <MedidorFortaleza password={nueva} />
        </CampoContrasena>

        <CampoContrasena
          id="perfil-confirmar"
          label="Confirmar nueva contraseña"
          value={confirmar}
          onChange={setConfirmar}
          placeholder="Repite la nueva contraseña"
          autoComplete="new-password"
          disabled={enviando}
        />

        <Button
          type="submit"
          size="lg"
          disabled={!completo}
          loading={enviando}
          className="mt-1 w-full"
        >
          {!enviando && <ShieldCheck className="size-3.5" />}
          Cambiar contraseña
        </Button>
      </form>
      <p className="mt-2 text-[11px] leading-normal text-neutral-400">
        Al cambiarla se cierra tu sesión en los demás dispositivos. El acceso
        puede tardar hasta 15 minutos en cortarse del todo.
      </p>
    </PerfilCard>
  );
}

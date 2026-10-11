"""Adaptador de la TikTok Shop Partner API (Affiliate Creator API). SIN CONECTAR.

Implementa lo que no depende de credenciales:
- Firma de peticiones según la guía oficial "Sign your API request"
  (https://partner.tiktokshop.com/docv2/page/sign-your-api-request, observada el 2026-10-11 vía buscador):
  1. Quitar `sign` y `access_token` de los parámetros de consulta.
  2. Ordenar las claves alfabéticamente y concatenar clave + valor.
  3. Anteponer la ruta de la petición.
  4. Si el Content-Type no es multipart/form-data, añadir el cuerpo.
  5. Envolver la cadena con el app secret al inicio y al final.
  6. HMAC-SHA256 con el app secret como clave, en hexadecimal.
- URL de autorización del creador (shop.tiktok.com/alliance/creator/auth con app_key y state).

Al conectar (ver docs/tiktok-shop-mx/15_ARQUITECTURA_MVP.md §7):
- Comparar `firmar()` con el ejemplo oficial de Python de esa página antes de la primera llamada real.
- Completar ENDPOINTS con las rutas y versiones de la referencia oficial; hasta entonces las llamadas
  lanzan ConexionPendiente en lugar de adivinar.
- Credenciales solo por variables de entorno: TIKTOK_APP_KEY, TIKTOK_APP_SECRET, TIKTOK_ACCESS_TOKEN.
"""

import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

from ..errores import ConexionPendiente

BASE_API = "https://open-api.tiktokglobalshop.com"  # verificar en la referencia oficial al conectar
URL_AUTORIZACION_CREADOR = "https://shop.tiktok.com/alliance/creator/auth"

# Rellenar al conectar con la referencia oficial. None = no verificado.
ENDPOINTS = {
    "perfil_creador": None,
    "ordenes_afiliado": None,
    "productos_mercado": None,
    "token": None,
}


def firmar(ruta: str, consulta: dict, cuerpo: bytes | str | None, secreto: str, content_type: str = "application/json") -> str:
    params = {k: v for k, v in consulta.items() if k not in ("sign", "access_token")}
    cadena = ruta + "".join(f"{k}{params[k]}" for k in sorted(params))
    if cuerpo and not content_type.lower().startswith("multipart/form-data"):
        cadena += cuerpo.decode("utf-8") if isinstance(cuerpo, bytes) else cuerpo
    cadena = f"{secreto}{cadena}{secreto}"
    return hmac.new(secreto.encode("utf-8"), cadena.encode("utf-8"), hashlib.sha256).hexdigest()


class ClienteTikTokShop:
    def __init__(self, app_key=None, app_secret=None, access_token=None):
        self.app_key = app_key or os.environ.get("TIKTOK_APP_KEY")
        self._secret = app_secret or os.environ.get("TIKTOK_APP_SECRET")
        self._token = access_token or os.environ.get("TIKTOK_ACCESS_TOKEN")

    def __repr__(self):  # nunca exponer secretos en registros
        return f"ClienteTikTokShop(app_key={'configurada' if self.app_key else 'no'}, secret={'***' if self._secret else 'no'}, token={'***' if self._token else 'no'})"

    def estado(self) -> dict:
        return {
            "app_key": bool(self.app_key),
            "app_secret": bool(self._secret),
            "access_token": bool(self._token),
            "endpoints_verificados": {k: v is not None for k, v in ENDPOINTS.items()},
        }

    def url_autorizacion_creador(self, state: str) -> str:
        if not self.app_key:
            raise ConexionPendiente("Falta TIKTOK_APP_KEY (requiere registrar una app en Partner Center, P-08).")
        if not state:
            raise ValueError("state es obligatorio en la autorización de creador.")
        return f"{URL_AUTORIZACION_CREADOR}?{urllib.parse.urlencode({'app_key': self.app_key, 'state': state})}"

    def _peticion(self, metodo, clave_endpoint, consulta=None, cuerpo=None):
        ruta = ENDPOINTS.get(clave_endpoint)
        if ruta is None:
            raise ConexionPendiente(f"El endpoint '{clave_endpoint}' no está verificado. Complétalo en ENDPOINTS al conectar.")
        if not (self.app_key and self._secret and self._token):
            raise ConexionPendiente(
                "Faltan credenciales en variables de entorno (TIKTOK_APP_KEY, TIKTOK_APP_SECRET, TIKTOK_ACCESS_TOKEN)."
            )
        consulta = dict(consulta or {}, app_key=self.app_key, timestamp=str(int(time.time())))
        datos = json.dumps(cuerpo, separators=(",", ":")).encode("utf-8") if cuerpo is not None else None
        consulta["sign"] = firmar(ruta, consulta, datos, self._secret)
        req = urllib.request.Request(
            f"{BASE_API}{ruta}?{urllib.parse.urlencode(consulta)}",
            data=datos,
            method=metodo,
            headers={"Content-Type": "application/json", "x-tts-access-token": self._token},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))

    def ordenes_afiliado(self, **filtros):
        return self._peticion("POST", "ordenes_afiliado", cuerpo=filtros)

    def perfil_creador(self):
        return self._peticion("GET", "perfil_creador")

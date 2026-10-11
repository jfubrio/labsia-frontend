class ErrorTSMX(Exception):
    """Error de dominio con mensaje apto para mostrar al usuario."""


class PermisoDenegado(ErrorTSMX):
    pass


class EstadoInvalido(ErrorTSMX):
    pass


class NoEncontrado(ErrorTSMX):
    pass


class ConexionPendiente(ErrorTSMX):
    """La integración externa existe en código pero aún no está configurada o verificada."""

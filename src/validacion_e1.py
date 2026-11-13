from urllib.parse import urlsplit


def url_https_valida(valor):
    if not isinstance(valor, str) or any(c.isspace() or ord(c) < 32 for c in valor):
        return False
    try:
        partes = urlsplit(valor)
        puerto = partes.port
        return bool(partes.scheme == 'https' and partes.hostname and partes.username is None
                    and partes.password is None and (puerto is None or 1 <= puerto <= 65535))
    except ValueError:
        return False

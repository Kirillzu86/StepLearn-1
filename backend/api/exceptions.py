import logging
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        view = context.get('view', None)
        view_name = view.__class__.__name__ if view else 'unknown_view'
        logger.exception('Unhandled exception in %s: %s', view_name, exc)

    if response is not None:
        if isinstance(response.data, dict):
            if 'detail' not in response.data:
                first_msg = None
                for key, val in response.data.items():
                    if isinstance(val, list) and val:
                        first_msg = str(val[0])
                        break
                    elif isinstance(val, str):
                        first_msg = val
                        break
                    elif isinstance(val, dict):
                        for sub_k, sub_v in val.items():
                            if isinstance(sub_v, list) and sub_v:
                                first_msg = str(sub_v[0])
                                break
                        if first_msg:
                            break
                if first_msg:
                    response.data['detail'] = first_msg
        elif isinstance(response.data, list):
            first_msg = str(response.data[0]) if response.data else "Ошибка валидации"
            response.data = {'detail': first_msg, 'errors': response.data}

    return response

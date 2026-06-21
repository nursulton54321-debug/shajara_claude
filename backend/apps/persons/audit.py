"""
Audit log yozuvchi yordamchi funksiyalar.
Views ichida ishlatiladi: log_action(request, 'create', instance)
"""
from .models import AuditLog


def get_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _diff(old_data, new_data):
    """Ikki dict orasidagi farqni {field: [old, new]} formatida qaytaradi."""
    changes = {}
    all_keys = set(old_data) | set(new_data)
    skip = {'updated_at', 'created_at', 'photo'}
    for key in all_keys:
        if key in skip:
            continue
        old_val = old_data.get(key)
        new_val = new_data.get(key)
        if str(old_val) != str(new_val):
            changes[key] = [str(old_val) if old_val is not None else None,
                            str(new_val) if new_val is not None else None]
    return changes


def log_action(request, action, instance=None, model_name='', changes=None):
    """
    Audit log yozadi.

    log_action(request, 'create', person_instance)
    log_action(request, 'update', person_instance, changes={'first_name': ['Ali','Vali']})
    log_action(request, 'delete', model_name='Person', changes={'repr': 'Matayev Elyor'})
    log_action(request, 'export')
    """
    user = getattr(request, 'user', None)
    if user and not user.is_authenticated:
        user = None

    obj_id   = None
    obj_repr = ''
    m_name   = model_name

    if instance is not None:
        obj_id   = getattr(instance, 'pk', None)
        obj_repr = str(instance)[:200]
        m_name   = m_name or instance.__class__.__name__

    AuditLog.objects.create(
        user        = user,
        action      = action,
        model_name  = m_name,
        object_id   = obj_id,
        object_repr = obj_repr,
        changes     = changes or {},
        ip_address  = get_ip(request),
    )


def instance_to_dict(instance, exclude=None):
    """Model instance'ni JSON-serializable dict'ga aylantiradi."""
    exclude = exclude or set()
    d = {}
    for field in instance._meta.fields:
        if field.name in exclude:
            continue
        val = getattr(instance, field.name)
        d[field.name] = str(val) if val is not None else None
    return d

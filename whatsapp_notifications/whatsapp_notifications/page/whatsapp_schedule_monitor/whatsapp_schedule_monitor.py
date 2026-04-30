"""
WhatsApp Schedule Monitor - Server-side data for the monitoring page
"""
import frappe
from frappe.utils import today, getdate, now_datetime, get_datetime, add_days, nowdate


@frappe.whitelist()
def get_schedule_data():
    """
    Return all scheduled rule data for the monitor page:
    - Birthday rules with next run, today's matches, last run info
    - Days Before/After notification rules with target date, matches, sent count
    - Recent activity from scheduled rules
    - Recent bulk sends (Envio em Massa WhatsApp)
    """
    return {
        "birthday_rules": _get_birthday_rules(),
        "date_event_rules": _get_date_event_rules(),
        "recent_activity": _get_recent_activity(),
        "bulk_sends": get_bulk_sends(limit=15),
        "now": str(now_datetime()),
        "today": today(),
    }


# ---------------------------------------------------------------------------
# Birthday Rules
# ---------------------------------------------------------------------------

def _get_birthday_rules():
    rules = frappe.get_all(
        "WhatsApp Birthday Rule",
        fields=[
            "name", "document_type", "birthdate_field", "send_time", "days_before",
            "last_run", "last_count", "last_status", "last_error", "enabled",
            "send_to_person", "send_to_group", "send_to_additional"
        ],
        order_by="enabled desc, name asc"
    )

    today_str = today()
    now = now_datetime()

    for rule in rules:
        rule["was_run_today"] = (
            bool(rule.get("last_run")) and
            getdate(rule["last_run"]) == getdate(today_str)
        )
        rule["next_run"] = _calc_birthday_next_run(rule, today_str, now)
        rule["matches_today"] = _count_birthday_matches(rule, today_str)
        rule["send_channels"] = _birthday_channels(rule)
        # Clean up internal fields not needed in UI
        rule.pop("birthdate_field", None)

    return rules


def _calc_birthday_next_run(rule, today_str, now):
    if not rule.get("enabled"):
        return None
    if not rule.get("send_time"):
        return None

    send_time_dt = get_datetime("{} {}".format(today_str, rule["send_time"]))

    if rule.get("was_run_today"):
        tomorrow = add_days(today_str, 1)
        return "{} {}".format(tomorrow, rule["send_time"])
    elif now < send_time_dt:
        return "{} {}".format(today_str, rule["send_time"])
    else:
        # send_time passed today but rule didn't run yet
        return "overdue"


def _count_birthday_matches(rule, today_str):
    if not rule.get("document_type") or not rule.get("birthdate_field"):
        return 0
    try:
        target = getdate(add_days(today_str, rule.get("days_before") or 0))
        result = frappe.db.sql(
            """SELECT COUNT(*) FROM `tab{doctype}`
               WHERE MONTH(`{field}`) = %s AND DAY(`{field}`) = %s
               AND docstatus < 2""".format(
                doctype=rule["document_type"],
                field=rule["birthdate_field"]
            ),
            (target.month, target.day)
        )
        return int(result[0][0]) if result else 0
    except Exception:
        return 0


def _birthday_channels(rule):
    channels = []
    if rule.get("send_to_person"):
        channels.append("Person")
    if rule.get("send_to_group"):
        channels.append("Group")
    if rule.get("send_to_additional"):
        channels.append("Additional")
    return ", ".join(channels) if channels else "-"


# ---------------------------------------------------------------------------
# Days Before / After Notification Rules
# ---------------------------------------------------------------------------

def _get_date_event_rules():
    """Return one entry per rule (grouped), each with a nested `offsets` list."""
    rules = frappe.get_all(
        "WhatsApp Notification Rule",
        filters={"event": ["in", ["Days Before", "Days After"]]},
        fields=[
            "name", "rule_name", "document_type", "event", "days_offset",
            "date_field", "enabled", "enable_active_hours",
            "active_hours_start", "active_hours_end", "send_once"
        ],
        order_by="enabled desc, document_type asc"
    )

    today_str = today()
    result = []

    for rule in rules:
        reminder_rows = frappe.get_all(
            "WhatsApp Notification Reminder",
            filters={"parent": rule["name"], "parenttype": "WhatsApp Notification Rule"},
            fields=["days"],
            order_by="days desc"
        )

        offset_entries = []
        if reminder_rows:
            rule["has_reminder_offsets"] = True
            for row in reminder_rows:
                days = int(row["days"] or 0)
                if not days:
                    continue
                target = _calc_target_date_from_days(rule["event"], today_str, days)
                match_info = _get_date_rule_matches(rule, target)
                sent = _count_sent_today_offset(rule["name"], days)
                offset_entries.append({
                    "days": days,
                    "days_left_label": _days_left_label(rule["event"], days),
                    "target_date": str(target) if target else None,
                    "matches_today": match_info["count"],
                    "sent_today": sent,
                    "is_done": match_info["count"] > 0 and sent >= match_info["count"],
                    "matching_docs": match_info["docs"],
                    "has_more": match_info["has_more"],
                })
        else:
            rule["has_reminder_offsets"] = False
            days = int(rule.get("days_offset") or 0)
            target = _calc_target_date(rule, today_str)
            match_info = _get_date_rule_matches(rule, target)
            sent = _count_sent_today(rule["name"])
            offset_entries.append({
                "days": days,
                "days_left_label": _days_left_label(rule["event"], days),
                "target_date": str(target) if target else None,
                "matches_today": match_info["count"],
                "sent_today": sent,
                "is_done": match_info["count"] > 0 and sent >= match_info["count"],
                "matching_docs": match_info["docs"],
                "has_more": match_info["has_more"],
            })

        rule["offsets"] = offset_entries
        rule["total_matches_today"] = sum(o["matches_today"] for o in offset_entries)
        rule["total_sent_today"] = sum(o["sent_today"] for o in offset_entries)
        rule["last_sent"] = _get_last_sent(rule["name"])
        rule["active_hours_label"] = _active_hours_label(rule)
        result.append(rule)

    return result


def _calc_target_date(rule, today_str):
    if not rule.get("days_offset"):
        return None
    offset = int(rule["days_offset"])
    if rule["event"] == "Days Before":
        return getdate(add_days(today_str, offset))
    else:  # Days After
        return getdate(add_days(today_str, -offset))


def _calc_target_date_from_days(event, today_str, days):
    if not days:
        return None
    if event == "Days Before":
        return getdate(add_days(today_str, days))
    else:
        return getdate(add_days(today_str, -days))


def _get_date_rule_matches(rule, target_date, limit=20):
    if not rule.get("document_type") or not rule.get("date_field") or not target_date:
        return {"count": 0, "docs": [], "has_more": False}
    try:
        all_names = frappe.get_all(
            rule["document_type"],
            filters={rule["date_field"]: str(target_date)},
            pluck="name"
        )
        count = len(all_names)
        docs = [{"name": n, "doctype": rule["document_type"]} for n in all_names[:limit]]
        return {"count": count, "docs": docs, "has_more": count > limit}
    except Exception:
        return {"count": 0, "docs": [], "has_more": False}


def _count_sent_today(rule_name):
    try:
        result = frappe.db.sql(
            """SELECT COUNT(*) FROM `tabWhatsApp Message Log`
               WHERE notification_rule = %s
               AND DATE(creation) = CURDATE()""",
            rule_name
        )
        return int(result[0][0]) if result else 0
    except Exception:
        return 0


def _count_sent_today_offset(rule_name, offset_days):
    try:
        result = frappe.db.sql(
            """SELECT COUNT(*) FROM `tabWhatsApp Message Log`
               WHERE notification_rule = %s
               AND reminder_days_offset = %s
               AND DATE(creation) = CURDATE()""",
            (rule_name, offset_days)
        )
        return int(result[0][0]) if result else 0
    except Exception:
        return 0


def _get_last_sent(rule_name):
    try:
        result = frappe.db.sql(
            """SELECT creation FROM `tabWhatsApp Message Log`
               WHERE notification_rule = %s
               ORDER BY creation DESC LIMIT 1""",
            rule_name,
            as_dict=True
        )
        return str(result[0]["creation"]) if result else None
    except Exception:
        return None


def _active_hours_label(rule):
    if not rule.get("enable_active_hours"):
        return "Anytime"
    start = (rule.get("active_hours_start") or "")[:5]
    end = (rule.get("active_hours_end") or "")[:5]
    if start and end:
        return "{} – {}".format(start, end)
    return "Restricted"


def _days_left_label(event, days):
    """Human-readable label for an offset, e.g. 'In 14 days', 'Tomorrow', 'Today'."""
    if days == 0:
        return "Today"
    if event == "Days Before":
        if days == 1:
            return "Tomorrow"
        return "In {} days".format(days)
    else:  # Days After
        if days == 1:
            return "Yesterday"
        return "{} days ago".format(days)


# ---------------------------------------------------------------------------
# Recent Activity
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_bulk_sends(limit=20):
    """Return recent Envio em Massa WhatsApp docs for the monitor page.

    Always shows non-completed sends; completed sends are only shown if created
    within the last 48 hours to keep the monitor view clean.
    """
    try:
        from frappe.utils import now_datetime, add_days
        cutoff = str(add_days(today(), -2))
        envios = frappe.db.sql("""
            SELECT name, aviso, titulo, status,
                   total, enviados, falhados, pendentes,
                   disparado_por, iniciado_em, concluido_em, ultimo_heartbeat
            FROM `tabEnvio em Massa WhatsApp`
            WHERE status != 'Concluído'
               OR DATE(creation) >= %s
            ORDER BY creation DESC
            LIMIT %s
        """, (cutoff, int(limit)), as_dict=True)

        now = str(now_datetime())
        for e in envios:
            done = (e.get("enviados") or 0) + (e.get("falhados") or 0)
            total = e.get("total") or 1
            e["progresso"] = round(done / total * 100)
            if e.get("status") == "Em Execução" and e.get("ultimo_heartbeat"):
                from frappe.utils import time_diff_in_seconds
                diff = time_diff_in_seconds(now, str(e["ultimo_heartbeat"]))
                if diff > 900:
                    e["possivelmente_interrompido"] = True
        return envios
    except Exception:
        frappe.log_error(title="get_bulk_sends error", message=frappe.get_traceback())
        return []


def _get_recent_activity():
    # Collect names of all date-event notification rules
    date_rule_names = frappe.get_all(
        "WhatsApp Notification Rule",
        filters={"event": ["in", ["Days Before", "Days After"]]},
        pluck="name"
    )

    if not date_rule_names:
        return []

    try:
        logs = frappe.get_all(
            "WhatsApp Message Log",
            filters={"notification_rule": ["in", date_rule_names]},
            fields=[
                "name", "notification_rule", "reference_doctype", "reference_name",
                "recipient_name", "phone", "status", "creation", "error_message"
            ],
            order_by="creation desc",
            limit=30
        )
        return logs
    except Exception:
        return []
